import React from "react";
import { defaultDoorCloseMs, wallHeight } from "../service/const";
import { pause, warn, debug } from "../service/generic";
import { geom } from "../service/geom";
import { npcToBodyKey } from "../service/rapier";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./World').State} w
 */
export default function useHandleEvents(w) {

  const state = useStateRef(/** @returns {State} */ () => ({
    doorToNpc: {},
    externalNpcs: new Set(),
    npcToAccess: {},
    npcToDoor: {},
    npcToRoom: new Map(),
    roomToNpcs: [],
    shouldIgnoreLongClick: undefined,

    canCloseDoor(door) {
      const closeNpcs = state.doorToNpc[door.gdKey];
      if (closeNpcs === undefined) {
        return true;
      } else if (closeNpcs.inside.size > 0) {
        return false;
      } else if (closeNpcs.nearby.size === 0) {
        return true;
      } else if (door.auto === true && door.locked === false) {
        return false;
      }

      for (const npcKey of closeNpcs.nearby) {
        if (w.npc.npc[npcKey]?.s.moving === true)
          return false;
      }
      return true;
    },
    changeNpcAccess(npcKey, regexDef, act = '+') {
      if (act === '+') {
        (state.npcToAccess[npcKey] ??= new Set()).add(regexDef);
      } else {
        (state.npcToAccess[npcKey] ??= new Set()).delete(regexDef);
      }
    },
    decodeObjectPick(r, g, b, a) {
      if (r === 1) {// wall
        const gmId = Math.floor(g);
        const instanceId = (b << 8) + a;
        const decoded = w.wall.decodeInstanceId(instanceId);
        return {
          picked: 'wall',
          gmId,
          ...decoded,
          instanceId,
        };
      }

      if (r === 2) {// floor
        const gmId = Math.floor(g);
        return {
          picked: 'floor',
          gmId,
          floor: true,
          instanceId: gmId,
        };
      }

      if (r === 3) {// ceiling
        const gmId = Math.floor(g);
        return {
          picked: 'ceiling',
          gmId,
          ceiling: true,
          height: wallHeight,
          instanceId: gmId,
        };
      }

      if (r === 4) {// door
        const instanceId = Math.floor(g);
        const decoded = w.door.decodeInstance(instanceId);
        return {
          picked: 'door',
          door: true,
          ...decoded,
          instanceId,
        };
      }

      if (r === 5) {// decor quad
        const instanceId = Math.floor(g);
        const quad = w.decor.quads[instanceId];
        return {
          picked: 'quad',
          ...quad.meta,
          instanceId,
        };
      }

      if (r === 6) {// obstacle
        const instanceId = Math.floor(g);
        const decoded = w.obs.decodeObstacleId(instanceId);
        return {
          picked: 'obstacle',
          obstacle: true,
          ...decoded,
          instanceId,
        };
      }

      if (r === 7) {// decor cuboid
        const instanceId = Math.floor(g);
        const cuboid = w.decor.cuboids[instanceId];
        return {
          picked: 'cuboid',
          ...cuboid.meta,
          instanceId,
        };
      }

      if (r === 8) {// npc
        const npcUid = (g << 8) + b;
        const npcKey = w.npc.pickUid.toKey.get(npcUid);
        return {
          picked: 'npc',
          npcKey,
          npcUid,
          npc: true,
          instanceId: npcUid, // not really an instance
        };
      }

      if (r === 9) {// lock-light
        const instanceId = Math.floor(g);
        const door = w.door.decodeInstance(instanceId);
        return {
          picked: 'lock-light',
          ...door.meta,
          instanceId,
        };
      }

      // warn(`${'decodeObjectPick'}: failed to decode: ${JSON.stringify({ r, g, b, a })}`);
      return null;
    },
    async handleEvents(e) {
      // debug('useHandleEvents', e);

      if ('npcKey' in e) {
        return state.handleNpcEvents(e);
      }

      switch (e.key) {
        case "changed-zoom": // 'near' or 'far'
          break;
        case "updated-gm-decor":
          // NOOP e.g. physics.worker rebuilds entire world onchange geomorphs
          break;
        case "long-pointerdown": { // toggle ContextMenu
          const lastDownMeta = w.view.getLastDownMeta();
          if (lastDownMeta !== null && state.shouldIgnoreLongClick?.(lastDownMeta)) {
            return;
          }

          if (e.distancePx <= (e.touch ? 10 : 5)) {
            w.menu.show({ x: e.screenPoint.x - 128, y: e.screenPoint.y });
            // prevent pan whilst pointer held down
            w.view.controls.saveState();
            w.view.controls.reset();
          } else {
            w.menu.hide();
          }
          break;
        }
        case "pointerdown":
          w.view.setLastDown(e);
          w.menu.hide();
          break;
        case "pointerup":
          // e.is3d && !w.menu.justOpen && state.onPointerUp3d(e);
          !e.touch && state.onPointerUpMenuDesktop(e);
          w.menu.justOpen = w.menu.ctOpen;
          break;
        case "pre-request-nav": {
          // ℹ️ (re)compute npcToRoom and roomToNpcs
          // ℹ️ dev should handle partial correctness e.g. by pausing

          w.menu.measure('pre-request-nav');
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
          w.menu.measure('pre-request-nav');
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
      const npc = w.n[e.npcKey];

      switch (e.key) {
        case "enter-collider":
          if (e.type === 'nearby' || e.type === 'inside') {
            state.onEnterDoorCollider(e);
          }
          break;
        case "exit-collider":
          if (e.type === 'nearby' || e.type === 'inside') {
            state.onExitDoorCollider(e);
          }
          break;
        case "spawned": {
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
        case "removed-npc": {
          w.physics.worker.postMessage({
            type: 'remove-bodies',
            bodyKeys: [npcToBodyKey(e.npcKey)],
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
        // case "started-moving":
        case "way-point":
          if (e.index === 0) {// start moving in next frame
            npc.agent?.updateParameters({ maxSpeed: npc.getMaxSpeed() });
          }
          if (e.next === null) {// final
            return;
          }
          
          for (const gdKey of state.npcToDoor[e.npcKey]?.nearby ?? []) {
            const door = w.door.byKey[gdKey];
            if (!(door.open === false && state.navSegIntersectsDoorway(e, e.next, door) === true)) {
              continue;
            } // incoming closed door:
            if (state.npcCanAccess(e.npcKey, door.gdKey) === true) {
              w.door.toggleDoorRaw(door, { open: true, access: true });
            } else {
              npc.stopMoving();
            }
          }
          break;
        case "stopped-moving":
          for (const gdKey of state.npcToDoor[e.npcKey]?.nearby ?? []) {
            const door = w.door.byKey[gdKey];
            door.open === true && state.tryCloseDoor(door.gmId, door.doorId);
          }
          break;
      }
    },
    navSegIntersectsDoorway(u, v, door) {
      // 🤔 more efficient approach?
      return geom.lineSegIntersectsPolygon(u, v, door.collidePoly);
    },
    npcCanAccess(npcKey, gdKey) {
      for (const regexDef of state.npcToAccess[npcKey] ?? []) {
        if ((regexCache[regexDef] ??= new RegExp(regexDef)).test(gdKey)) {
          return true;
        }
      }
      return false;
    },
    npcNearDoor(npcKey, gdKey) {
      return state.doorToNpc[gdKey]?.nearby.has(npcKey);
      // const npc = w.npc.getNpc(npcKey);
      // const position = npc.getPosition();
      // const gm = w.gms[gmId];
      // const center = gm.inverseMatrix.transformPoint({ x: position.x, y: position.z });
      // return geom.circleIntersectsConvexPolygon(center, npc.getRadius(), gm.doors[doorId].poly);
    },
    onEnterDoorCollider(e) {
      if (e.type === 'nearby') {
        (state.npcToDoor[e.npcKey] ??= { nearby: new Set(), inside: new Set() }).nearby.add(e.gdKey);
        (state.doorToNpc[e.gdKey] ??= { nearby: new Set(), inside: new Set() }).nearby.add(e.npcKey);
        
        const door = w.door.byKey[e.gdKey];
        if (door.open === true) {// door already open
          return;
        }

        if (door.auto === true && door.locked === false) {
          state.toggleDoor(e.gdKey, { open: true, eventMeta: { nearbyNpcKey: e.npcKey } });
          return; // opened auto unlocked door
        } 
        
        const npc = w.npc.getNpc(e.npcKey);
        if (state.navSegIntersectsDoorway(npc.getPoint(), { x: npc.nextCorner.x, y: npc.nextCorner.z }, door) === true) {
          if (door.auto === true && state.npcCanAccess(e.npcKey, e.gdKey) === true) {
            state.toggleDoor(e.gdKey, { open: true, npcKey: npc.key, access: true });
          } else {
            npc.stopMoving();
          }
        }
        return;
      }
      
      if (e.type === 'inside') {
        (state.npcToDoor[e.npcKey] ??= { nearby: new Set(), inside: new Set() }).inside.add(e.gdKey);
        (state.doorToNpc[e.gdKey] ??= { nearby: new Set(), inside: new Set() }).inside.add(e.npcKey);

        const door = w.door.byKey[e.gdKey];
        const npc = w.npc.npc[e.npcKey];
        if (
          door.open === false
          && state.npcCanAccess(e.npcKey, e.gdKey) === true
          // && state.navSegIntersectsDoorway(npc.getPoint(), { x: npc.nextCorner.x, y: npc.nextCorner.z }, door)
        ) {
          state.toggleDoor(e.gdKey, { open: true, eventMeta: { nearbyNpcKey: e.npcKey } });
        }

        w.events.next({ key: 'enter-doorway', npcKey: e.npcKey, gmId: e.gmId, doorId: e.doorId, gdKey: e.gdKey });
        return;
      }
    },
    onExitDoorCollider(e) {
      const door = w.door.byKey[e.gdKey];
      const npc = w.npc.npc[e.npcKey]; // undefined on removal

      if (e.type === 'nearby') {
        state.npcToDoor[e.npcKey].nearby.delete(e.gdKey);
        const closeNpcs = state.doorToNpc[e.gdKey];
        closeNpcs.nearby.delete(e.npcKey);

        // ℹ️ try close door under conditions
        if (door.open === true) {
          return;
        } else if (door.locked === true) {
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
    removeFromSensors(npcKey) {
      const closeDoors = state.npcToDoor[npcKey];
      for (const gdKey of closeDoors?.nearby ?? []) {// npc may never have been close to any door
        const door = w.door.byKey[gdKey];
        state.onExitDoorCollider({ key: 'exit-collider', type: 'nearby', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
        if (closeDoors.inside.delete(gdKey) === true) {
          state.onExitDoorCollider({ key: 'exit-collider', type: 'inside', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
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
            clear: state.canCloseDoor(door) === true,
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
 * @property {undefined | ((lastDownMeta: Geom.Meta) => boolean)} shouldIgnoreLongClick
 * @property {Map<string, Geomorph.GmRoomId>} npcToRoom npcKey to gmRoomId
 * Relates `npcKey` to current room
 * @property {{[roomId: number]: Set<string>}[]} roomToNpcs
 * The "inverse" of npcToRoom i.e. `roomToNpc[gmId][roomId]` is a set of `npcKey`s
 * @property {Set<string>} externalNpcs
 * `npcKey`s not inside any room
 *
 * @property {(door: Geomorph.DoorState) => boolean} canCloseDoor
 * @property {(u: Geom.VectJson, v: Geom.VectJson, door: Geomorph.DoorState) => boolean} navSegIntersectsDoorway
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcCanAccess
 * @property {(npcKey: string, regexDef: string, act?: '+' | '-') => void} changeNpcAccess
 * @property {(r: number, g: number, b: number, a: number) => null | NPC.DecodedObjectPick} decodeObjectPick
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(e: Extract<NPC.Event, { key: 'enter-collider'; type: 'nearby' | 'inside' }>) => void} onEnterDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'exit-collider'; type: 'nearby' | 'inside' }>) => void} onExitDoorCollider
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcNearDoor
 * @property {(e: NPC.PointerUpEvent) => void} onPointerUpMenuDesktop
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
