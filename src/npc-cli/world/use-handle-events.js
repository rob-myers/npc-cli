import React from "react";
import { defaultDoorCloseMs } from "../service/const";
import { pause, warn } from "../service/generic";
import { geom, tmpVec1 } from "../service/geom";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./World').State} w
 */
export default function useHandleEvents(w) {

  const state = useStateRef(/** @returns {State} */ () => ({
    doorToNpc: {},
    npcToAccess: {},
    npcToDoor: {},
    npcToRoom: new Map(),
    roomToNpcs: [],
    externalNpcs: new Set(),

    npcCanAccess(npcKey, gdKey) {
      for (const regexDef of state.npcToAccess[npcKey] ?? []) {
        if ((regexCache[regexDef] ??= new RegExp(regexDef)).test(gdKey)) {
          return true;
        }
      }
      return false;
    },
    changeNpcAccess(npcKey, regexDef, act = '+') {
      if (act === '+') {
        (state.npcToAccess[npcKey] ??= new Set()).add(regexDef);
      } else {
        (state.npcToAccess[npcKey] ??= new Set()).delete(regexDef);
      }
    },
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
          // ℹ️ dev should handle partial correctness e.g. by pausing

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
          // ℹ️ dev should handle partial correctness e.g. by pausing
          state.doorToNpc = {};
          state.npcToDoor = {};
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
          } else {// Respawn
            const prevGrId = state.npcToRoom.get(npc.key);
            if (prevGrId !== undefined) {
              state.roomToNpcs[prevGrId.gmId][prevGrId.roomId]?.delete(npc.key);
            }
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
          state.removeFromSensors(e.npcKey);
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
    isUpcomingDoor(npc, door) {
      const { target } = npc.s;
      if (npc.agent === null || target === null) {
        return false;
      }

      // Is target inside doorway?
      tmpVec1.set(target.x, target.z);
      if (door.axisAligned === true
        ? door.rect.contains(tmpVec1) === true
        : door.doorway.contains(tmpVec1) === true
      ) {// intersecting door we don't necessarily go through
        return true;
      }

      // Does polyline induced by upcoming corners intersect door's seg?
      let src = npc.getPoint();
      let dist = door.center.distanceToSquared(src), nextDist = 0;

      for (const corner of npc.agent.corners()) {
        if (geom.getLineSegsIntersection(src, tmpVec1.set(corner.x, corner.z), door.src, door.dst, true) !== null) {
          return true; // typically 1st seg intersects, if any
        }
        if ((nextDist = door.center.distanceToSquared(tmpVec1)) > dist) {
          return false; // distance must decrease before intersect
        } else {
          dist = nextDist;
        }
      }

      return false;
    },
    async moveNpc(npcKey, point) {
      const npc = w.npc.getNpc(npcKey);
      await npc.moveTo({ x: point.x, y: 0, z: point.y }, { onStart() {
        // handle move into/through doorway when already nearby
        for (const gdKey of state.npcToDoor[npcKey]?.nearby ?? []) {
          const door = w.door.byKey[gdKey];
          if (door.open === false && state.isUpcomingDoor(npc, door) === true) {
            if (state.npcCanAccess(npcKey, door.gdKey)) {
              w.door.toggleDoorRaw(door, { open: true, access: true });
            } else {
              npc.stopMoving();
            }
            break;
          }
        }
      }});
    },
    npcNearDoor(npcKey, gdKey) {
      return state.doorToNpc[gdKey]?.nearby.has(npcKey);
      // const npc = w.npc.getNpc(npcKey);
      // const position = npc.getPosition();
      // const gm = w.gms[gmId];
      // const center = gm.inverseMatrix.transformPoint({ x: position.x, y: position.z });
      // return geom.circleIntersectsConvexPolygon(center, npc.getRadius(), gm.doors[doorId].poly);
    },
    onEnterSensor(e) {
      if (e.type === 'nearby') {
        (state.npcToDoor[e.npcKey] ??= { nearby: new Set(), inside: new Set() }).nearby.add(e.gdKey);
        (state.doorToNpc[e.gdKey] ??= { nearby: new Set(), inside: new Set() }).nearby.add(e.npcKey);
        
        const door = w.door.byKey[e.gdKey];
        if (door.open === true) {
          return; // door already open
        }

        if (door.auto === true && door.locked === false) {
          state.toggleDoor(e.gdKey, { open: true, eventMeta: { nearbyNpcKey: e.npcKey } });
          return; // opened auto unlocked door
        } 
        
        const npc = w.npc.getNpc(e.npcKey);
        if (state.isUpcomingDoor(npc, door) === true) {
          if (door.auto === true && w.e.npcCanAccess(e.npcKey, e.gdKey) === true) {
            state.toggleDoor(e.gdKey, { open: true, npcKey: npc.key, access: true });
          } else {
            // setTimeout(() => npc.stopMoving(), 300);
            npc.stopMoving();
          }
        }
        return;
      }
      
      if (e.type === 'inside') {
        (state.npcToDoor[e.npcKey] ??= { nearby: new Set(), inside: new Set() }).inside.add(e.gdKey);
        (state.doorToNpc[e.gdKey] ??= { nearby: new Set(), inside: new Set() }).inside.add(e.npcKey);
        w.events.next({ key: 'enter-doorway', npcKey: e.npcKey, gmId: e.gmId, doorId: e.doorId, gdKey: e.gdKey });
        return;
      }
    },
    onExitSensor(e) {
      const door = w.door.byKey[e.gdKey];
      const npc = w.npc.npc[e.npcKey]; // undefined on removal

      if (e.type === 'nearby') {
        state.npcToDoor[e.npcKey].nearby.delete(e.gdKey);
        const closeNpcs = state.doorToNpc[e.gdKey];
        closeNpcs.nearby.delete(e.npcKey);

        // ℹ️ try close door under conditions
        if (door.open === true) {
          return;
        } else if (door.locked === true && closeNpcs.inside.size === 0) {
          // if locked, none inside, none moving nearby, try close 
          for (const npcKey of closeNpcs.nearby) {
            if (w.npc.npc[npcKey]?.s.moving === true) return;
          }
          state.tryCloseDoor(door.gmId, door.doorId)
        } else if (door.auto === true && closeNpcs.nearby.size === 0) {
          // if auto and none nearby, try close 
          state.tryCloseDoor(door.gmId, door.doorId);
        }
        return;
      }
      
      if (e.type === 'inside') {
        if (npc === undefined) {
          return; // npc was removed
        }

        // npc entered room
        state.npcToDoor[e.npcKey].inside.delete(e.gdKey);
        state.doorToNpc[e.gdKey].inside.delete(e.npcKey);

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

        // ℹ️ trigger exit-room and enter-room on exit doorway
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
        e.is3d && w.menu.show({ x: e.screenPoint.x + 12, y: e.screenPoint.y });
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
      const closeDoors = state.npcToDoor[npcKey];
      for (const gdKey of closeDoors.nearby ?? []) {
        const door = w.door.byKey[gdKey];
        state.onExitSensor({ key: 'exit-sensor', type: 'nearby', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
        if (closeDoors.inside.delete(gdKey) === true) {
          state.onExitSensor({ key: 'exit-sensor', type: 'inside', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
        }
      }
      state.npcToDoor[npcKey]?.nearby.clear();
      state.npcToDoor[npcKey]?.inside.clear();
    },
    someNpcNearDoor(gdKey) {
      return state.doorToNpc[gdKey]?.nearby.size > 0;
    },
    toggleDoor(gdKey, opts = {}) {
      const door = w.door.byKey[gdKey];

      if (typeof opts.npcKey === 'string') {
        if (state.npcNearDoor(opts.npcKey, gdKey) === false) {
          return door.open; // not close enough
        }
        opts.access ??= state.npcCanAccess(opts.npcKey, gdKey);
      }

      opts.clear = state.someNpcNearDoor(gdKey) === false;
      return w.door.toggleDoorRaw(door, opts);
    },
    toggleLock(gdKey, opts = {}) {
      const door = w.door.byKey[gdKey];

      if (typeof opts.npcKey === 'string') {
        if (state.npcNearDoor(opts.npcKey, gdKey) === false) {
          return door.locked; // not close enough
        }
        opts.access ??= state.npcCanAccess(opts.npcKey, gdKey);
      }

      return w.door.toggleLockRaw(door, opts);
    },
    tryCloseDoor(gmId, doorId, eventMeta) {
      const door = w.door.byGmId[gmId][doorId];
      w.door.cancelClose(door); // re-open resets timer:
      door.closeTimeoutId = window.setTimeout(() => {
        if (door.open === true) {
          w.door.toggleDoorRaw(door, {
            clear: !state.someNpcNearDoor(door.gdKey),
            eventMeta,
          });
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
 * @property {{ [gdKey: Geomorph.GmDoorKey]: Record<'nearby' | 'inside', Set<string>> }} doorToNpc
 * Relates `Geomorph.GmDoorKey` to nearby/inside `npcKey`s
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Relates `npcKey` to strings defining RegExp's matching `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: Record<'nearby' | 'inside', Set<Geomorph.GmDoorKey>> }} npcToDoor
 * Relate `npcKey` to nearby `Geomorph.GmDoorKey`s
 * @property {Map<string, Geomorph.GmRoomId>} npcToRoom npcKey to gmRoomId
 * Relates `npcKey` to current room
 * @property {{[roomId: number]: Set<string>}[]} roomToNpcs
 * The "inverse" of npcToRoom i.e. `roomToNpc[gmId][roomId]` is a set of `npcKey`s
 * @property {Set<string>} externalNpcs
 * `npcKey`s not inside any room
 *
 * @property {(npc: NPC.NPC, door: Geomorph.DoorState) => boolean} isUpcomingDoor
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcCanAccess
 * @property {(npcKey: string, regexDef: string, act?: '+' | '-') => void} changeNpcAccess
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(e: Extract<NPC.Event, { key: 'enter-sensor' }>) => void} onEnterSensor
 * @property {(e: Extract<NPC.Event, { key: 'exit-sensor' }>) => void} onExitSensor
 * @property {(npcKey: string, point: Geom.VectJson) => Promise<void>} moveNpc
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcNearDoor
 * @property {(e: NPC.PointerUpEvent | NPC.PointerUpOutsideEvent) => void} onPointerUpMenuDesktop
 * @property {(e: NPC.PointerUpEvent & { is3d: true }) => void} onPointerUp3d
 * @property {(npcKey: string) => void} removeFromSensors
 * @property {(gdKey: Geomorph.GmDoorKey) => boolean} someNpcNearDoor
 * @property {(gdKey: Geomorph.GmDoorKey, opts?: { npcKey?: string } & Geomorph.ToggleDoorOpts) => boolean} toggleDoor
 * @property {(gdKey: Geomorph.GmDoorKey, opts?: { npcKey?: string } & Geomorph.ToggleLockOpts) => boolean} toggleLock
 * @property {(gmId: number, doorId: number, eventMeta?: Geom.Meta) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {(npc: NPC.NPC) => void} tryPutNpcIntoRoom
 */

/** e.g. `'^g0'` -> `/^g0/` */
const regexCache = /** @type {Record<string, RegExp>} */ ({});
