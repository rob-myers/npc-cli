import React from "react";
import { Vect } from "../geom";
import { defaultDoorCloseMs, npcNearUiDist, wallHeight } from "../service/const";
import { pause, warn, debug } from "../service/generic";
import { geom } from "../service/geom";
import { npcToBodyKey } from "../service/rapier";
import { toV3, toXZ } from "../service/three";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./World').State} w
 */
export default function useHandleEvents(w) {

  const state = useStateRef(/** @returns {State} */ () => ({
    doorToNpcs: {},
    doorToOffMesh: {},
    externalNpcs: new Set(),
    npcToAccess: {},
    npcToDoors: {},
    npcToRoom: new Map(),
    roomToNpcs: [],
    pressMenuFilters: [],

    canCloseDoor(door) {
      const closeNpcs = state.doorToNpcs[door.gdKey];
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
        if (w.n[npcKey]?.s.target !== null)
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
        const instanceId = (g << 8) + b;
        const decoded = w.wall.decodeInstanceId(instanceId);
        return {
          picked: 'wall',
          ...decoded,
          instanceId,
        };
      }

      if (r === 2) {// floor
        const instanceId = (g << 8) + b;
        return {
          picked: 'floor',
          gmId: instanceId,
          floor: true,
          instanceId,
        };
      }

      if (r === 3) {// ceiling
        const instanceId = (g << 8) + b;
        return {
          picked: 'ceiling',
          gmId: instanceId,
          ceiling: true,
          height: wallHeight,
          instanceId,
        };
      }

      if (r === 4) {// door
        const instanceId = (g << 8) + b;
        const decoded = w.door.decodeInstance(instanceId);
        return {
          picked: 'door',
          door: true,
          ...decoded,
          instanceId,
        };
      }

      if (r === 5) {// decor quad
        const instanceId = (g << 8) + b;
        const quad = w.decor.quads[instanceId];
        return {
          picked: 'quad',
          ...quad.meta,
          instanceId,
        };
      }

      if (r === 6) {// obstacle
        const instanceId = (g << 8) + b;
        const decoded = w.obs.decodeInstanceId(instanceId);
        return {
          picked: 'obstacle',
          obstacle: true,
          ...decoded,
          instanceId,
        };
      }

      if (r === 7) {// decor cuboid
        const instanceId = (g << 8) + b;
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
        const instanceId = (g << 8) + b;
        const door = w.door.decodeInstance(instanceId);
        return {
          picked: 'lock-light',
          'lock-light': true,
          ...door.meta,
          instanceId,
        };
      }

      // warn(`${'decodeObjectPick'}: failed to decode: ${JSON.stringify({ r, g, b, a })}`);
      return null;
    },
    getNearbyNpcKeys(gmId, roomId, point) {
      const npcKeys = /** @type {string[]} */ ([]);
      try {
        for (const npcKey of state.roomToNpcs[gmId][roomId] ?? []) {
          const npcPoint = w.n[npcKey].getPoint();
          if (Math.abs(npcPoint.x - point.x) < npcNearUiDist && Math.abs(npcPoint.y - point.y) < npcNearUiDist) {
            npcKeys.push(npcKey);
          }
        }
      } catch (e) {
        console.error('getNearbyNpcKeys failed', e);
      }
      return npcKeys;
    },
    async handleEvents(e) {
      // debug('useHandleEvents', e);

      if ('npcKey' in e) {// 🔔 if key present, assume value truthy
        return state.handleNpcEvents(e);
      }

      switch (e.key) {
        case "changed-zoom": // 'near' or 'far'
          break;
        case "updated-gm-decor":
          // NOOP e.g. physics.worker rebuilds entire world onchange geomorphs
          break;
        case "long-pointerdown": { // toggle ContextMenu
          const { lastDown } = w.view;
          if (lastDown?.meta === undefined) {
            return; // should be unreachable
          }
          if (state.pressMenuFilters.some(fltr => fltr(lastDown.meta))) {
            return; // prevent ContextMenu
          }

          if (e.distancePx <= (e.touch ? 20 : 5)) {
            state.showDefaultContextMenu();
          }
          break;
        }
        case "nav-updated": {
          const excludeDoorsFilter = w.crowd.getFilter(w.lib.queryFilterType.excludeDoors);
          // walkable only, not unwalkable
          excludeDoorsFilter.includeFlags = 2 ** 1;
          break;
        }
        case "pointerdown":
          w.cm.hide();
          break;
        case "pointerup":
          !e.touch && state.onPointerUpMenuDesktop(e);
          break;
        case "pre-request-nav": {
          // ℹ️ (re)compute npcToRoom and roomToNpcs
          // ℹ️ dev should handle partial correctness e.g. by pausing

          w.menu.measure('pre-request-nav');
          const prevRoomToNpcs = state.roomToNpcs;
          const prevExternalNpcs = state.externalNpcs;
          state.roomToNpcs = w.gms.map((_, gmId) => 
            e.changedGmIds[gmId] === false ? prevRoomToNpcs[gmId] : []
          );
          state.externalNpcs = new Set();

          for (const [gmId, byRoom] of prevRoomToNpcs.entries()) {
            if (e.changedGmIds[gmId] === false) {
              continue;
            } // else `true` (changed) or `undefined` (gmId no longer exists)
            
            // We'll recompute every npc previously in this gmId
            const npcs = Object.values(byRoom).flatMap(npcKeys =>
              Array.from(npcKeys).map(npcKey => w.n[npcKey])
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
          state.doorToNpcs = {};
          state.npcToDoors = {};
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
        case "enter-off-mesh": {
          const { offMesh } = e;
          const door = w.door.byKey[offMesh.gdKey];
          
          /** Current and most recent user of offMeshConnection (if any) */
          const other = state.doorToOffMesh[offMesh.gdKey]?.at(-1);
          const doorInUse = other !== undefined && (
            other.orig !== offMesh // opposite direction
            || other.seg === 'init' // other hasn't reached main segment
            || w.n[other.npcKey].position.distanceTo(npc.position) < 1.2 * npc.getRadius()
          );

          if (doorInUse || (
            door.open === false &&
            state.toggleDoor(offMesh.gdKey, { open: true, npcKey: e.npcKey }) === false
          )) {
            // cancel traversal
            const agent = /** @type {NPC.CrowdAgent} */ (npc.agent);
            const agentAnim = w.crowd.raw.getAgentAnimation(agent.agentIndex);
            agentAnim.set_active(false);
            npc.stopMoving();
            return;
          }
          
          // register traversal
          npc.s.offMesh = {
            npcKey: e.npcKey,
            seg: 'init',
            init: { x: offMesh.src.x - npc.position.x, y: offMesh.src.z - npc.position.z },
            main: { x: offMesh.dst.x - offMesh.src.x, y: offMesh.dst.z - offMesh.src.z },
            orig: offMesh,
          };
          (state.doorToOffMesh[offMesh.gdKey] ??= []).push(npc.s.offMesh);

          // force open door
          w.door.toggleDoorRaw(door, { open: true, access: true });
          break;
        }
        case "exit-off-mesh": {
          npc.s.offMesh = null;
          state.doorToOffMesh[e.offMesh.gdKey] = state.doorToOffMesh[e.offMesh.gdKey].filter(
            x => x.npcKey !== e.npcKey
          );
          // w.nav.navMesh.setPolyFlags(state.npcToOffMesh[e.npcKey].offMeshRef, w.lib.navPolyFlag.walkable);
          break;
        }
        case "spawned": {
          if (npc.s.spawns === 1) {// 1st spawn
            const { x, y, z } = npc.getPosition();
            w.physics.worker.postMessage({
              type: 'add-npcs',
              npcs: [{ npcKey: e.npcKey, position: { x, y, z } }],
            });
            npc.setLabel(e.npcKey);
          } else {// Respawn
            const prevGrId = state.npcToRoom.get(npc.key);
            if (prevGrId !== undefined) {
              state.roomToNpcs[prevGrId.gmId][prevGrId.roomId]?.delete(npc.key);
            }
          }

          state.npcToRoom.set(npc.key, {...e.gmRoomId});
          (state.roomToNpcs[e.gmRoomId.gmId][e.gmRoomId.roomId] ??= new Set()).add(e.npcKey);

          if (w.disabled === true) {
            w.debugTick();
          }
          break;
        }
        case "removed-npc": {
          const nearbyGdKeys = Array.from(state.npcToDoors[e.npcKey]?.nearby ?? []);

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

          for (const gdKey of nearbyGdKeys) {
            const index = state.doorToOffMesh[gdKey]?.findIndex(x => x.npcKey === e.npcKey);
            if (index >= 0) {
              state.doorToOffMesh[gdKey].splice(index, 1);
              break; // e.npcKey in at most one door
            }
          }

          w.c.delete(e.npcKey);
          break;
        }
        case "way-point": {
          if (e.index !== 0 && npc.position.distanceTo(npc.lastTarget) < 1.5) {
            npc.s.lookSecs = 0.3; // 🔔 slower final turn
          }
          break;
        }
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
    npcNearDoor(npcKey, gdKey) {// 🚧 unused
      // return state.doorToNpc[gdKey]?.nearby.has(npcKey);
      const { src, dst } = w.door.byKey[gdKey];
      return geom.lineSegIntersectsCircle(
        src,
        dst,
        w.n[npcKey].getPoint(),
        1.5, // 🚧 hard-coded
      );
    },
    onEnterDoorCollider(e) {
      if (e.type === 'nearby') {
        (state.npcToDoors[e.npcKey] ??= { nearby: new Set(), inside: new Set() }).nearby.add(e.gdKey);
        (state.doorToNpcs[e.gdKey] ??= { nearby: new Set(), inside: new Set() }).nearby.add(e.npcKey);
        
        const door = w.d[e.gdKey];
        if (door.open === true) {
          return; // door already open
        }

        if (door.auto === true && door.locked === false) {
          state.toggleDoor(e.gdKey, { open: true, npcKey: e.npcKey });
          return; // opened auto unlocked door
        }
      }
      
      // if (e.type === 'inside') {
      //   (state.npcToDoors[e.npcKey] ??= { nearby: new Set(), inside: new Set() }).inside.add(e.gdKey);
      //   (state.doorToNpcs[e.gdKey] ??= { nearby: new Set(), inside: new Set() }).inside.add(e.npcKey);

      //   const door = w.door.byKey[e.gdKey];
      //   const npc = w.n[e.npcKey];
      //   if (
      //     door.open === false
      //     && state.npcCanAccess(e.npcKey, e.gdKey) === true
      //     // && state.navSegIntersectsDoorway(npc.getPoint(), { x: npc.nextCorner.x, y: npc.nextCorner.z }, door)
      //   ) {
      //     state.toggleDoor(e.gdKey, { open: true, npcKey: e.npcKey });
      //   }

      //   w.events.next({ key: 'enter-doorway', npcKey: e.npcKey, gmId: e.gmId, doorId: e.doorId, gdKey: e.gdKey });
      //   return;
      // }
    },
    onExitDoorCollider(e) {
      const door = w.door.byKey[e.gdKey];
      const npc = w.npc.npc[e.npcKey]; // undefined on removal

      if (e.type === 'nearby') {
        state.npcToDoors[e.npcKey].nearby.delete(e.gdKey);
        const closeNpcs = state.doorToNpcs[e.gdKey];
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
      
      if (e.type === 'inside') {// 🚧 remove once exit/enter-room has been migrated
        if (npc === undefined) {
          return; // npc was removed
        }

        // npc entered room
        // state.npcToDoors[e.npcKey].inside.delete(e.gdKey);
        // state.doorToNpcs[e.gdKey].inside.delete(e.npcKey);

        const prev = state.npcToRoom.get(e.npcKey);
        if (door.gmId !== prev?.gmId) {
          return; // hull doors have 2 sensors, so can ignore one
        }

        // w.events.next({ key: 'exit-doorway', npcKey: e.npcKey, gmId: door.gmId, doorId: door.doorId, gdKey: door.gdKey });

        const onOtherSide = w.gmGraph.isOnOtherSide(door, prev.roomId, npc.getPoint());
        if (onOtherSide === false) {
          return; // stayed in same room
        }
        
        const next = w.gmGraph.getOtherGmRoomId(door, prev.roomId);
        if (next === null) {
          return warn(`${e.npcKey}: expected non-null next room (${door.gdKey})`);
        }

        // 🚧 enter/exit-off-mesh should have srcGrKey, dstGrKey
        // 🚧 exit-room, enter-room should be triggered by exit-off-mesh

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
        state.showDefaultContextMenu();
      }
    },
    removeFromSensors(npcKey) {
      const closeDoors = state.npcToDoors[npcKey];
      for (const gdKey of closeDoors?.nearby ?? []) {// npc may never have been close to any door
        const door = w.door.byKey[gdKey];
        state.onExitDoorCollider({ key: 'exit-collider', type: 'nearby', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
        if (closeDoors.inside.delete(gdKey) === true) {
          state.onExitDoorCollider({ key: 'exit-collider', type: 'inside', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
        }
      }
      state.npcToDoors[npcKey]?.nearby.clear();
      state.npcToDoors[npcKey]?.inside.clear();
    },
    showDefaultContextMenu() {
      const { lastDown } = w.view;
      if (lastDown === undefined) {
        return;
      } else if ('npcKey' in lastDown.meta) {
        const { npcKey } = lastDown.meta;
        w.cm.setTracked(w.n[npcKey].m.group);
        w.debug.setPickIndicator();  
        w.cm.show(lastDown);
      } else {
        w.cm.setTracked();
        w.debug.setPickIndicator(lastDown);  
        w.cm.show(lastDown);
      }
    },
    someNpcNearDoor(gdKey) {
      return state.doorToNpcs[gdKey]?.nearby.size > 0;
    },
    toggleDoor(gdKey, opts) {
      const door = w.door.byKey[gdKey];

      // clear if already closed and offMeshConnection free
      opts.clear = door.open === false || state.doorToOffMesh[gdKey] === undefined;
      
      opts.access ??= (
        opts.npcKey === undefined
        || (door.auto === true && door.locked === false)
        || state.npcCanAccess(opts.npcKey, gdKey)
      );

      return w.door.toggleDoorRaw(door, opts);
    },
    toggleLock(gdKey, opts) {
      const door = w.door.byKey[gdKey];

      if (opts.point === undefined || opts.npcKey === undefined) {
        // e.g. game master i.e. no npc
        return w.door.toggleLockRaw(door, opts);
      }

      if (tmpVect1.copy(opts.point).distanceTo(w.n[opts.npcKey].getPoint()) > 1.5) {
        return false; // e.g. button not close enough
      }

      opts.access ??= state.npcCanAccess(opts.npcKey, gdKey);

      return w.door.toggleLockRaw(door, opts);
    },
    tryCloseDoor(gmId, doorId, eventMeta) {
      const door = w.door.byGmId[gmId][doorId];
      w.door.cancelClose(door); // re-open resets timer:
      door.closeTimeoutId = window.setTimeout(() => {
        if (door.open === true) {
          w.door.toggleDoorRaw(door, {
            clear: state.canCloseDoor(door) === true,
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
 * @property {{ [gdKey: Geomorph.GmDoorKey]: Record<'nearby' | 'inside', Set<string>> }} doorToNpcs
 * Relates `Geomorph.GmDoorKey` to nearby/inside `npcKey`s
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Relates `npcKey` to strings defining RegExp's matching `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: Record<'nearby' | 'inside', Set<Geomorph.GmDoorKey>> }} npcToDoors
 * Relate `npcKey` to nearby `Geomorph.GmDoorKey`s
 * @property {{ [gdKey: Geomorph.GmDoorKey]: NPC.OffMeshState[] }} doorToOffMesh
 * Multiple agents can traverse a single offMeshConnection in the same direction at same direction.
 * @property {((lastDownMeta: Geom.Meta) => boolean)[]} pressMenuFilters
 * Prevent ContextMenu on long press if any of these return `true`.
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
 * @property {(gmId: number, roomId: number, point: Geom.VectJson) => string[]} getNearbyNpcKeys
 * Get possible meta acts e.g. may not be possible because npc not close enough
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(e: Extract<NPC.Event, { key: 'enter-collider'; type: 'nearby' | 'inside' }>) => void} onEnterDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'exit-collider'; type: 'nearby' | 'inside' }>) => void} onExitDoorCollider
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcNearDoor
 * @property {(e: NPC.PointerUpEvent) => void} onPointerUpMenuDesktop
 * @property {(npcKey: string) => void} removeFromSensors
 * @property {() => void} showDefaultContextMenu
 * Default context menu, unless clicked on an npc
 * @property {(gdKey: Geomorph.GmDoorKey) => boolean} someNpcNearDoor
 * @property {(gdKey: Geomorph.GmDoorKey, opts: { npcKey?: string; } & Geomorph.ToggleDoorOpts) => boolean} toggleDoor
 * Returns `true` iff successful.
 * @property {(gdKey: Geomorph.GmDoorKey, opts: { npcKey?: string; point?: Geom.VectJson; } & Geomorph.ToggleLockOpts) => boolean} toggleLock
 * Returns `true` iff successful.
 * @property {(gmId: number, doorId: number, eventMeta?: Geom.Meta) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {(npc: NPC.NPC) => void} tryPutNpcIntoRoom
 */

/** e.g. `'^g0'` -> `/^g0/` */
const regexCache = /** @type {Record<string, RegExp>} */ ({});
const tmpVect1 = new Vect();
