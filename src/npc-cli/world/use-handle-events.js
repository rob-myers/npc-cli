import React from "react";
import { defaultDoorCloseMs } from "../service/const";
import { warn } from "../service/generic";
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
    npcToRoom: {},

    handleEvents(e) {
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
          w.menu.justOpen = w.menu.isOpen;
          break;
        case "pointerup-outside":
          !e.touch && state.onPointerUpMenuDesktop(e);
          break;
        case "decor-instantiated":
          w.setReady();
          break;
        case "try-close-door":
          state.tryCloseDoor(e.gmId, e.doorId, e.meta);
          break;
      }
    },
    handleNpcEvents(e) {
      switch (e.key) {
        case "entered-sensor": {
          const door = w.door.byKey[e.gdKey];
          const npc = w.npc.getNpc(e.npcKey);

          if (e.type === 'nearby') {
            (state.npcToNearby[e.npcKey] ??= new Set).add(e.gdKey);
            (state.doorToNearby[e.gdKey] ??= new Set).add(e.npcKey);
            if (npc.s.permitNav === 'anywhere' || (door.auto === true && !door.locked)) {
              state.toggleDoor(e.gdKey, { open: true, eventMeta: { nearbyNpcKey: e.npcKey } });
            }
          } else if (e.type === 'inside') {
            // NOOP
          }

          break;
        }
        case "exited-sensor": {
          const door = w.door.byKey[e.gdKey];
          const npc = w.npc.getNpc(e.npcKey);

          if (e.type === 'nearby') {
            state.npcToNearby[e.npcKey]?.delete(e.gdKey);
            state.doorToNearby[e.gdKey]?.delete(e.npcKey);
          } else if (e.type === 'inside') {
            // npc entered room
            const prev = state.npcToRoom[e.npcKey];

            if (door.gmId !== prev.gmId) {
              return; // hull doors have 2 sensors, so can ignore one
            }
            
            const next = w.gmGraph.findRoomContaining(npc.getPoint());
            if (next === null) {
              return warn(`${e.npcKey}: expected non-null next room (${door.gdKey})`);
            }
            if (prev.grKey === next.grKey) {
              return; // stayed inside room
            }
            setTimeout(() => {
              state.npcToRoom[e.npcKey] = next;
              w.events.next({ key: 'entered-room', npcKey: e.npcKey, ...next, prev  });
            });
          }
          break;
        }
        case "spawned": {
          const npc = w.npc.npc[e.npcKey];
          const { x, y, z } = npc.getPosition();
          if (npc.s.spawns === 1) {// 1st spawn
            w.physics.worker.postMessage({
              type: 'add-npcs',
              npcs: [{ npcKey: e.npcKey, position: { x, y, z } }],
            });
          }
          state.npcToRoom[npc.key] = {...e.gmRoomId};
          break;
        }
        case "removed-npc":
          w.physics.worker.postMessage({
            type: 'remove-npcs',
            npcKeys: [e.npcKey],
          });
          state.removeFromSensors(e.key);
          delete state.npcToRoom[e.npcKey];
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
  }));
  
  w.es = state; // s for 'shared'

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
 * @property {{ [npcKey: string]: Geomorph.GmRoomId }} npcToRoom
 * Relates `npcKey` to current room
 *
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcCanAccess
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(npcKey: string, gdKey: number, doorId: number) => boolean} npcNearDoor
 * @property {(e: NPC.PointerUpEvent | NPC.PointerUpOutsideEvent) => void} onPointerUpMenuDesktop
 * @property {(e: NPC.PointerUpEvent & { is3d: true }) => void} onPointerUp3d
 * @property {(npcKey: string) => void} removeFromSensors
 * @property {(gdKey: Geomorph.GmDoorKey, opts?: { npcKey?: string } & Geomorph.ToggleDoorOpts) => boolean} toggleDoor
 * @property {(gdKey: Geomorph.GmDoorKey, opts?: { npcKey?: string } & Geomorph.ToggleLockOpts) => boolean} toggleLock
 * @property {(gmId: number, doorId: number, eventMeta?: Geom.Meta) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 */
