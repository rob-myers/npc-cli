import React from "react";
import { defaultDoorCloseMs } from "../service/const";
import { pause, warn } from "../service/generic";
import { geom } from "../service/geom";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./World').State} w
 */
export default function useHandleEvents(w) {

  const state = useStateRef(/** @returns {State} */ () => ({
    doorToNearby: {},
    npcToAccess: {},
    npcToNearby: {},
    npcToRoom: new Map(),
    roomToNpcs: [],
    externalNpcs: new Set(),

    async handleEvents(e) {
      // info('useHandleEvents', e);

      if ('npcKey' in e) {
        return state.handleNpcEvents(e);
      }

      switch (e.key) {
        case "changed-zoom":
          w.ceil.thickerTops = e.level === 'far';
          w.ceil.draw();
          break;
        case "long-pointerdown":
          // mobile/desktop show/hide ContextMenu
          if (e.distancePx <= (e.touch ? 10 : 5)) {
            w.menu.show({ x: e.screenPoint.x - 128, y: e.screenPoint.y });
            // prevent pan whilst pointer held down
            w.ui.controls.saveState();
            w.ui.controls.reset();
          } else {
            w.menu.hide();
          }
          break;
        case "pointerdown":
          w.ui.setLastDown(e);
          w.menu.hide();
          break;
        case "pointerup":
          e.is3d && !w.menu.justOpen && state.onPointerUp3d(e);
          !e.touch && state.onPointerUpMenuDesktop(e);
          w.menu.justOpen = w.menu.ctOpen;
          break;
        case "pointerup-outside":
          !e.touch && state.onPointerUpMenuDesktop(e);
          break;
        case "decor-instantiated":
          w.setReady();
          break;
        case "pre-request-nav": {
          // ℹ️ (re)compute npcToRoom and roomToNpcs
          const prevRoomToNpcs = state.roomToNpcs;
          const prevExternalNpcs = state.externalNpcs;
          state.roomToNpcs = w.gms.map((_, gmId) => 
            e.changedGmIds[gmId] === false ? prevRoomToNpcs[gmId] : {}
          );
          state.externalNpcs = new Set();

          for (const [gmId, byRoom] of prevRoomToNpcs.entries()) {
            if (e.changedGmIds[gmId] === false) {
              continue;
            } // else `true` (changed) or `undefined` (gmId no longer exists)
            
            // We'll recompute every npc previously in this gmId
            const npcs = Object.values(byRoom).flatMap(npcKeys =>
              Array.from(npcKeys).map(npcKey => w.npc.npc[npcKey])
            );

            for (const [i, npc] of npcs.entries()) {
              if (i > 0 && i % 5 === 0) await pause(); // batching
              state.tryPutNpcIntoRoom(npc);
            }
          }

          // try fix previous external npcs
          for (const npcKey of prevExternalNpcs) {
            const npc = w.npc.npc[npcKey];
            state.tryPutNpcIntoRoom(npc);
          }
          break;
        }
        case "pre-setup-physics":
          // 🚧
          break;
        case "try-close-door":
          state.tryCloseDoor(e.gmId, e.doorId, e.meta);
          break;
      }
    },
    handleNpcEvents(e) {
      switch (e.key) {
        case "enter-sensor": 
          state.onEnterSensor(e);
          break;
        case "exit-sensor":
          state.onExitSensor(e);
          break;
        case "spawned": {
          const npc = w.npc.npc[e.npcKey];
          const { x, y, z } = npc.getPosition();
          if (npc.s.spawns === 1) {// 1st spawn
            w.physics.worker.postMessage({
              type: 'add-npcs',
              npcs: [{ npcKey: e.npcKey, position: { x, y, z } }],
            });
          }
          state.npcToRoom.set(npc.key, {...e.gmRoomId});
          (state.roomToNpcs[e.gmRoomId.gmId][e.gmRoomId.roomId] ??= new Set()).add(e.npcKey);
          break;
        }
        case "removed-npc":
          w.physics.worker.postMessage({
            type: 'remove-npcs',
            npcKeys: [e.npcKey],
          });
          state.removeFromSensors(e.key);
          const gmRoomId = state.npcToRoom.get(e.npcKey);
          if (gmRoomId !== undefined) {
            state.npcToRoom.delete(e.npcKey);
            state.roomToNpcs[gmRoomId.gmId][gmRoomId.roomId].delete(e.npcKey);
          } else {
            state.externalNpcs.delete(e.key);
          }
          break;
      }
    },
    npcCanAccess(npcKey, gdKey) {
      return Array.from(
        state.npcToAccess[npcKey] ?? []
      ).some(prefix => gdKey.startsWith(prefix));
    },
    npcNearDoor(npcKey, gmId, doorId) {
      const npc = w.npc.getNpc(npcKey);
      const position = npc.getPosition();
      const gm = w.gms[gmId];
      const center = gm.inverseMatrix.transformPoint({ x: position.x, y: position.z });
      return geom.circleIntersectsConvexPolygon(center, npc.getRadius(), gm.doors[doorId].poly);
    },
    onEnterSensor(e) {
      const door = w.door.byKey[e.gdKey];
      const npc = w.npc.getNpc(e.npcKey);

      if (e.type === 'nearby') {
        (state.npcToNearby[e.npcKey] ??= new Set).add(e.gdKey);
        (state.doorToNearby[e.gdKey] ??= new Set).add(e.npcKey);
        if (npc.s.permitNav === 'anywhere' || (door.auto === true && !door.locked)) {
          state.toggleDoor(e.gdKey, { open: true, eventMeta: { nearbyNpcKey: e.npcKey } });
        }
      } else if (e.type === 'inside') {
        w.events.next({ key: 'enter-doorway', npcKey: e.npcKey, gmId: door.gmId, doorId: door.doorId, gdKey: door.gdKey });
      }
    },
    onExitSensor(e) {
      const door = w.door.byKey[e.gdKey];
      const npc = w.npc.getNpc(e.npcKey);

      if (e.type === 'nearby') {
        state.npcToNearby[e.npcKey]?.delete(e.gdKey);
        state.doorToNearby[e.gdKey]?.delete(e.npcKey);
        return;
      }
      
      if (e.type === 'inside') {// npc entered room
        const prev = state.npcToRoom.get(e.npcKey);

        if (door.gmId !== prev?.gmId) {
          return; // hull doors have 2 sensors, so can ignore one
        }

        w.events.next({ key: 'exit-doorway', npcKey: e.npcKey, gmId: door.gmId, doorId: door.doorId, gdKey: door.gdKey });

        const onOtherSide = w.gmGraph.isOnOtherSide(door, prev.roomId, npc.getPoint());
        if (onOtherSide === false) {
          return; // stayed in same room
        }
        
        const next = w.gmGraph.getOtherGmRoomId(door, prev.roomId);
        if (next === null) {
          return warn(`${e.npcKey}: expected non-null next room (${door.gdKey})`);
        }
        setTimeout(() => {
          const gmRoomId = state.npcToRoom.get(e.npcKey);
          if (gmRoomId !== undefined) {
            state.roomToNpcs[gmRoomId.gmId][gmRoomId.roomId].delete(e.npcKey);
          }
          state.npcToRoom.set(e.npcKey, next);
          (state.roomToNpcs[next.gmId][next.roomId] ??= new Set()).add(e.npcKey);
          w.events.next({ key: 'exit-room', npcKey: e.npcKey, ...prev });
          w.events.next({ key: 'enter-room', npcKey: e.npcKey, ...next });
        });
      }
    },
    onPointerUpMenuDesktop(e) {
      if (e.rmb && e.distancePx <= 5) {
        w.menu.show({ x: e.screenPoint.x + 12, y: e.screenPoint.y });
      } else if (!e.justLongDown) {
        w.menu.hide();
      }
    },
    onPointerUp3d(e) {
      if (e.rmb === true || e.justLongDown === true || e.pointers !== 1) {
        return;
      }
      if (e.distancePx > (e.touch === true ? 5 : 1)) {
        return;
      }
    },
    removeFromSensors(npcKey) {
      for (const gdKey of state.npcToNearby[npcKey] ?? []) {
        const door = w.door.byKey[gdKey];
        state.doorToNearby[gdKey].delete(npcKey);
        if (door.auto === true && !(state.doorToNearby[gdKey]?.size > 0)) {
          state.tryCloseDoor(door.gmId, door.doorId);
        }
      }
      state.npcToNearby[npcKey]?.clear();
    },
    toggleDoor(gdKey, opts = {}) {
      const door = w.door.byKey[gdKey];

      if (typeof opts.npcKey === 'string') {
        if (!state.npcNearDoor(opts.npcKey, door.gmId, door.doorId)) {
          return door.open; // not close enough
        }
        opts.access ??= state.npcCanAccess(opts.npcKey, door.gdKey);
      }

      opts.clear = !(state.doorToNearby[door.gdKey]?.size > 0);
      return w.door.toggleDoorRaw(door, opts);
    },
    toggleLock(gdKey, opts = {}) {
      const door = w.door.byKey[gdKey];

      if (typeof opts.npcKey === 'string') {
        if (!state.npcNearDoor(opts.npcKey, door.gmId, door.doorId)) {
          return door.locked; // not close enough
        }
        opts.access ??= state.npcCanAccess(opts.npcKey, door.gdKey);
      }

      return w.door.toggleLockRaw(door, opts);
    },
    tryCloseDoor(gmId, doorId, eventMeta) {
      const door = w.door.byGmId[gmId][doorId];
      w.door.cancelClose(door); // re-open resets timer:
      door.closeTimeoutId = window.setTimeout(() => {
        if (door.open === true) {
          w.door.toggleDoorRaw(door, { clear: !(state.doorToNearby[door.gdKey]?.size > 0), eventMeta });
          state.tryCloseDoor(gmId, doorId); // recheck in {ms}
        } else {
          delete door.closeTimeoutId;
        }
      }, defaultDoorCloseMs);
    },
    tryPutNpcIntoRoom(npc) {
      const grId = w.gmGraph.findRoomContaining(npc.getPoint(), true);
      if (grId !== null) {
        state.npcToRoom.set(npc.key, grId);
        state.externalNpcs.delete(npc.key);
        (state.roomToNpcs[grId.gmId][grId.roomId] ??= new Set()).add(npc.key);
      } else {// Erase stale info and warn
        state.npcToRoom.delete(npc.key);
        state.externalNpcs.add(npc.key);
        warn(`${npc.key}: no longer inside any room`);
      }
    },
  }));
  
  w.e = state; // e for 'events state'

  React.useEffect(() => {
    const sub = w.events.subscribe(state.handleEvents);
    return () => {
      sub.unsubscribe();
    };
  }, []);
}

/**
 * @typedef State
 * @property {{ [gdKey: Geomorph.GmDoorKey]: Set<string> }} doorToNearby
 * Relates `Geomorph.GmDoorKey` to nearby `npcKey`s
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Relates `npcKey` to prefixes of accessible `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: Set<Geomorph.GmDoorKey> }} npcToNearby
 * Relate `npcKey` to nearby `Geomorph.GmDoorKey`s
 * @property {Map<string, Geomorph.GmRoomId>} npcToRoom npcKey to gmRoomId
 * Relates `npcKey` to current room
 * @property {{[roomId: number]: Set<string>}[]} roomToNpcs
 * `roomToNpc[gmId][roomId]` is a set of npcKeys
 * @property {Set<string>} externalNpcs
 * Keys of npcs not inside any room
 *
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcCanAccess
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(e: Extract<NPC.Event, { key: 'enter-sensor' }>) => void} onEnterSensor
 * @property {(e: Extract<NPC.Event, { key: 'exit-sensor' }>) => void} onExitSensor
 * @property {(npcKey: string, gdKey: number, doorId: number) => boolean} npcNearDoor
 * @property {(e: NPC.PointerUpEvent | NPC.PointerUpOutsideEvent) => void} onPointerUpMenuDesktop
 * @property {(e: NPC.PointerUpEvent & { is3d: true }) => void} onPointerUp3d
 * @property {(npcKey: string) => void} removeFromSensors
 * @property {(gdKey: Geomorph.GmDoorKey, opts?: { npcKey?: string } & Geomorph.ToggleDoorOpts) => boolean} toggleDoor
 * @property {(gdKey: Geomorph.GmDoorKey, opts?: { npcKey?: string } & Geomorph.ToggleLockOpts) => boolean} toggleLock
 * @property {(gmId: number, doorId: number, eventMeta?: Geom.Meta) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {(npc: NPC.NPC) => void} tryPutNpcIntoRoom
 */
