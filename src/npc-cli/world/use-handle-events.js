import React from "react";
import * as THREE from "three";
import { Vect } from "../geom";
import { defaultDoorCloseMs, wallHeight } from "../service/const";
import { pause, warn, debug, testNever } from "../service/generic";
import { geom } from "../service/geom";
import { globalLoggerLinksRegex } from "../terminal/Logger";
import { npcToBodyKey } from "../service/rapier";
import { getTempInstanceMesh } from "../service/three";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./World').State} w
 */
export default function useHandleEvents(w) {

  const state = useStateRef(/** @returns {State} */ () => ({
    doorToNearbyNpcs: {},
    doorToOffMesh: {},
    externalNpcs: new Set(),
    npcToAccess: {},
    npcToDoors: {},
    npcToRoom: new Map(),
    pressMenuFilters: [],
    roomToNpcs: [],

    canCloseDoor(door) {
      const closeNpcs = state.doorToNearbyNpcs[door.gdKey];
      if (closeNpcs === undefined) {
        return true;
      } else if (state.doorToOffMesh[door.gdKey]?.length > 0) {
        return false; // nope: npc(s) using doorway
      } else if (closeNpcs.size === 0) {
        return true;
      } else if (door.auto === true && door.locked === false) {
        return false; // nope: npc(s) trigger sensor
      }
      return true;
    },
    clearOffMesh(npc) {
      // offMeshConnection can happen when `npc.s.offMesh === null`
      // e.g. npc without access near door
      npc.agentAnim?.set_active(false);
      
      if (npc.s.offMesh === null) {
        return;
      }

      const { gdKey } = npc.s.offMesh.orig;
      npc.s.offMesh = null;

      state.doorToOffMesh[gdKey] = state.doorToOffMesh[gdKey].filter(
        x => x.npcKey !== npc.key
      );
      (state.npcToDoors[npc.key] ??= { inside: null, nearby: new Set() }).inside = null;
      // w.nav.navMesh.setPolyFlags(state.npcToOffMesh[e.npcKey].offMeshRef, w.lib.navPolyFlag.walkable);
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
        const npcKey = w.npc.pickIdToKey.get(npcUid);
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
        const decoded = w.door.decodeInstance(instanceId);
        return {
          picked: 'lock-light',
          'lock-light': true,
          ...decoded,
          instanceId,
        };
      }

      // warn(`${'decodeObjectPick'}: failed to decode: ${JSON.stringify({ r, g, b, a })}`);
      return null;
    },
    followNpc(npcKey) {
      const npc = w.n[npcKey];
      w.view.followPosition(npc.position);
    },
    getRaycastIntersection(e, decoded) {
      /** @type {THREE.Mesh} */
      let mesh;

      // handle fractional device pixel ratio e.g. 2.625 on Pixel
      const glPixelRatio = w.r3f.gl.getPixelRatio();
      const { left, top } = (/** @type {HTMLElement} */ (e.target)).getBoundingClientRect();

      const normalizedDeviceCoords = new THREE.Vector2(
        -1 + 2 * (((e.clientX - left) * glPixelRatio) / w.view.canvas.width),
        +1 - 2 * (((e.clientY - top) * glPixelRatio) / w.view.canvas.height),
      );
      w.view.raycaster.setFromCamera(normalizedDeviceCoords, w.r3f.camera);

      switch (decoded.picked) {
        case 'floor': mesh = getTempInstanceMesh(w.floor.inst, decoded.instanceId); break;
        case 'wall': mesh = getTempInstanceMesh(w.wall.inst, decoded.instanceId); break;
        case 'npc': mesh = w.n[decoded.npcKey].m.mesh; break;
        case 'door': mesh = getTempInstanceMesh(w.door.inst, decoded.instanceId); break;
        case 'quad': mesh = getTempInstanceMesh(w.decor.quadInst, decoded.instanceId); break;
        case 'obstacle': mesh = getTempInstanceMesh(w.obs.inst, decoded.instanceId); break;
        case 'ceiling': mesh = getTempInstanceMesh(w.ceil.inst, decoded.instanceId); break;
        case 'cuboid': mesh = getTempInstanceMesh(w.decor.cuboidInst, decoded.instanceId); break;
        case 'lock-light': mesh = getTempInstanceMesh(w.door.lockSigInst, decoded.instanceId); break;
        default: throw testNever(decoded.picked);
      }

      const [intersection] = w.view.raycaster.intersectObject(mesh);

      if (intersection !== undefined) {
        return { intersection, mesh }; // provide temp mesh
      } else {
        return null;
      }
    },
    grantNpcAccess(npcKey, regexDef) {
      (state.npcToAccess[npcKey] ??= new Set()).add(regexDef);
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
          if (state.pressMenuFilters.some(filter => filter(lastDown.meta))) {
            return; // prevent ContextMenu
          }
          if (w.view.isPointerEventDrag(e) === false) {
            state.showDefaultContextMenu();
          }
          break;
        }
        case "nav-updated": {
          // const excludeDoorsFilter = w.crowd.getFilter(w.lib.queryFilterType.excludeDoors);
          // excludeDoorsFilter.includeFlags = 2 ** 1; // walkable only, not unwalkable
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
          state.doorToNearbyNpcs = {};
          state.doorToOffMesh = {};
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
        case "clear-off-mesh":
          state.clearOffMesh(npc);
          break;
        case "enter-collider":
          if (e.type === 'nearby') {
            state.onEnterDoorCollider(e);
          }
          break;
        case "exit-collider":
          if (e.type === 'nearby') {
            state.onExitDoorCollider(e);
          }
          break;
        case "enter-off-mesh": // enter init segment
          state.onEnterOffMeshConnection(e, npc);
          break;
        case "enter-off-mesh-main": // enter main segment
          state.onEnterOffMeshConnectionMain(e, npc);
          break;
        case "exit-off-mesh": // exit main segment
          state.onExitOffMeshConnection(e, npc);
          break;
        case "enter-room": {
          const { npcKey, gmId, roomId, grKey } = e;
          state.npcToRoom.set(npcKey, { gmId, roomId, grKey });
          (state.roomToNpcs[gmId][roomId] ??= new Set()).add(npcKey);

          if (npc.s.target !== null && npc.position.distanceTo(npc.s.target) <= 1) {
            npc.s.lookSecs = 0.3; // slower look if stopping soon
          }
          break;
        }
        case "exit-room": {
          state.npcToRoom.delete(e.npcKey);
          state.roomToNpcs[e.gmId][e.roomId]?.delete(e.npcKey);
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

          // npc might have been inside a doorway
          const gdKey = state.npcToDoors[e.npcKey]?.inside;
          if (typeof gdKey === 'string') {
            state.npcToDoors[e.npcKey].inside = null;
            state.doorToOffMesh[gdKey] = (state.doorToOffMesh[gdKey] ?? []).filter(
              x => x.npcKey !== e.npcKey
            );
          }

          w.cm.refreshOptsPopUp();
          w.bubble.delete(e.npcKey);
          break;
        }
        case "spawned": {
          if (npc.s.spawns === 1) {
            // 1st spawn
            const { x, y, z } = npc.position;
            w.physics.worker.postMessage({
              type: 'add-npcs',
              npcs: [{ npcKey: e.npcKey, position: { x, y, z } }],
            });
            npc.setLabel(e.npcKey);
          } else {
            // Respawn
            const prevGrId = state.npcToRoom.get(npc.key);
            if (prevGrId !== undefined) {
              state.roomToNpcs[prevGrId.gmId][prevGrId.roomId]?.delete(npc.key);
            }
          }

          state.npcToRoom.set(npc.key, {...e.gmRoomId});
          (state.roomToNpcs[e.gmRoomId.gmId][e.gmRoomId.roomId] ??= new Set()).add(e.npcKey);

          w.cm.refreshOptsPopUp(); // update npcKey select
          w.bubble.get(e.npcKey)?.updateOffset(); // update speechBubble height

          if (w.disabled === true) {
            w.npc.tickOnceDebounced();
          }
          break;
        }
        case "speech":
          w.menu.say(e.npcKey, e.speech);
          break;
        case "started-moving": {
          /**
           * 🔔 avoid initial incorrect offMeshConnection traversal, by
           *   replanning immediately before 1st updateRequestMoveTarget.
           * 🚧 better fix e.g. inside Recast-Detour
           */
          const agent = /** @type {NPC.CrowdAgent} */ (npc.agent);
          agent.raw.set_targetReplan(true);

          if (e.showNavPath === true) {
            const path = w.npc.findPath(npc.position, /** @type {THREE.Vector3} */ (npc.s.target));
            w.debug.setNavPath(path ?? []);
          }
          break;
        }
      }
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
    onEnterDoorCollider(e) {// e.type === 'nearby'
      (state.npcToDoors[e.npcKey] ??= { nearby: new Set(), inside: null }).nearby.add(e.gdKey);
      (state.doorToNearbyNpcs[e.gdKey] ??= new Set()).add(e.npcKey);
      
      const door = w.d[e.gdKey];
      if (door.open === true) {
        return; // door already open
      }

      if (door.auto === true && door.locked === false) {
        state.toggleDoor(e.gdKey, { open: true, npcKey: e.npcKey });
        return; // opened auto unlocked door
      }
    },
    onEnterOffMeshConnection(e, npc) {
      const { offMesh } = e;
      const door = w.door.byKey[offMesh.gdKey];

      // detect conflicting traversal
      if (state.doorToOffMesh[offMesh.gdKey]?.findLast(other => 
        other.orig.srcGrKey !== offMesh.srcGrKey // opposite direction
        // || other.seg === 0 // hasn't reached main segment
      )) {
        return npc.stopMoving();
      }

      // detect blocking npcKey in small room
      if (offMesh.dstRoomMeta.small === true && Array.from(state.doorToNearbyNpcs[offMesh.gdKey] ?? []).find(npcKey =>
        npcKey !== e.npcKey && w.n[npcKey].position.distanceToSquared(offMesh.dst) < 0.1 ** 2
      )) {
        return npc.stopMoving();
      }
      

      // try open closed door
      if (door.open === false &&
        state.toggleDoor(offMesh.gdKey, { open: true, npcKey: e.npcKey }) === false
      ) {
        return npc.stopMoving();
      }
      
      const adjusted = state.overrideOffMeshConnectionAngle(npc, offMesh, door);
      
      // register adjusted traversal
      npc.s.offMesh = {
        npcKey: e.npcKey,
        seg: 0,
        src: adjusted.src,
        dst: adjusted.dst,
        init: { x: adjusted.src.x - npc.position.x, y: adjusted.src.y - npc.position.z },
        main: { x: adjusted.dst.x - adjusted.src.x, y: adjusted.dst.y - adjusted.src.y },
        orig: offMesh,
      };
      (state.doorToOffMesh[offMesh.gdKey] ??= []).push(npc.s.offMesh);
      (state.npcToDoors[e.npcKey] ??= { inside: null, nearby: new Set() }).inside = offMesh.gdKey;

      w.door.toggleDoorRaw(door, { open: true, access: true }); // force open door (open longer)
      w.events.next({ key: 'exit-room', npcKey: e.npcKey, ...w.lib.getGmRoomId(e.offMesh.srcGrKey) });
    },
    onEnterOffMeshConnectionMain(e, npc) {
      const offMesh = /** @type {NPC.OffMeshState} */ (npc.s.offMesh);
      const agent = /** @type {NPC.CrowdAgent} */ (npc.agent);
      
      // 🔔 on enter main seg, if another is traversing main seg, go slowly
      // 🔔 we ignore intersections e.g. where two npcs go diagonally at same time
      for (const tr of state.doorToOffMesh[offMesh.orig.gdKey] ?? []) {
        if (tr.npcKey === e.npcKey) continue;
        if (tr.seg === 0) continue;
        const anim = /** @type {import("./npc").dtCrowdAgentAnimation} */ (npc.agentAnim);
        anim.set_tmax(anim.t + tmpVect1.copy(npc.getPoint()).distanceTo(offMesh.dst) / npc.getSlowSpeed());
        agent.updateParameters({ maxSpeed: npc.getSlowSpeed() });
        npc.startAnimation('Walk');
        break;
      }
    },
    onExitDoorCollider(e) {// e.type === 'nearby'
      const door = w.door.byKey[e.gdKey];

      state.npcToDoors[e.npcKey].nearby.delete(e.gdKey);
      const closeNpcs = state.doorToNearbyNpcs[e.gdKey];
      closeNpcs.delete(e.npcKey);

      // ℹ️ try close door under conditions
      if (door.open === true) {
        return;
      } else if (door.locked === true) {
        state.tryCloseDoor(door.gmId, door.doorId)
      } else if (door.auto === true && closeNpcs.size === 0) {
        // if auto and none nearby, try close 
        state.tryCloseDoor(door.gmId, door.doorId);
      }
    },
    onExitOffMeshConnection(e, npc) {
      state.clearOffMesh(npc);

      if (npc.agent?.maxSpeed === npc.getSlowSpeed()) {// resume original speed/anim
        npc.agent.updateParameters({ maxSpeed: npc.getMaxSpeed() });
        npc.s.run === true && npc.startAnimation('Run');
      }

      w.events.next({ key: 'enter-room', npcKey: e.npcKey, ...w.lib.getGmRoomId(e.offMesh.dstGrKey) });
    },
    onPointerUpMenuDesktop(e) {
      if (e.rmb && e.distancePx <= 5) {
        state.showDefaultContextMenu();
      }
    },
    overrideOffMeshConnectionAngle(npc, offMesh, door) {
      // Entrances are aligned to offMeshConnections
      // - entrance segment (enSrc, enDst)
      // - exit segment (exSrc, exDst)
      const { src: enSrc, dst: enDst } = door.entrances[offMesh.aligned === true ? 0 : 1];
      const { src: exSrc, dst: exDst } = door.entrances[offMesh.aligned === true ? 1 : 0];

      const npcPoint = Vect.from(npc.getPoint());

      // agent.corners() not available because ag->ncorners is 0 on offMeshConnection
      const agent = /** @type {NPC.CrowdAgent} */ (npc.agent);
      const corner = {
        x: agent.raw.get_cornerVerts(6 + 0),
        y: agent.raw.get_cornerVerts(6 + 2),
      };

      // 🔔 extend npcPoint --> corner in each direction, since
      // offMeshConnections are slightly away from doorway 
      const agSrc = {
        x: npcPoint.x - (corner.x - npcPoint.x),
        y: npcPoint.y - (corner.y - npcPoint.y),
      };
      const agDst = {
        x: corner.x + (corner.x - npcPoint.x),
        y: corner.y + (corner.y - npcPoint.y),
      };

      const enLambda = geom.getClosestOnSegToSeg(enSrc, enDst, agSrc, agDst);
      let newSrc = {
        x: enSrc.x + enLambda * (enDst.x - enSrc.x),
        y: enSrc.y + enLambda * (enDst.y - enSrc.y),
      };
      /** @type {Geom.VectJson} */
      let newDst;
      
      // if newSrc --> corner intersects exit segment, use it (avoid turn)
      const exIota = geom.getLineSegsIntersection(exSrc, exDst, newSrc, corner);
      
      if (exIota === null) {
        const exLambda = geom.getClosestOnSegToSeg(exSrc, exDst, agSrc, agDst);
        newDst = { 
          x: exSrc.x + exLambda * (exDst.x - exSrc.x),
          y: exSrc.y + exLambda * (exDst.y - exSrc.y),
        };
        
        if (exLambda === 0 || exLambda === 1) {// if "turning around corner"
          // if npcPoint --> newDst intersects entrance segment, use it (avoid turn)
          const enIota = geom.getLineSegsIntersection(enSrc, enDst, npcPoint, newDst);
          if (enIota !== null) {
            newSrc = { 
              x: enSrc.x + enIota * (enDst.x - enSrc.x),
              y: enSrc.y + enIota * (enDst.y - enSrc.y),
            };
          }
        }
      } else {
        newDst = { 
          x: exSrc.x + exIota * (exDst.x - exSrc.x),
          y: exSrc.y + exIota * (exDst.y - exSrc.y),
        };
      }

      // console.log({
      //   src: offMesh.src,
      //   dst: offMesh.dst,
      //   corner,
      //   newSrc,
      //   newDst,
      // });

      // adjust RecastDetour dtCrowdAgentAnimation
      const anim = /** @type {import("./npc").dtCrowdAgentAnimation} */ (npc.agentAnim);
      anim.set_initPos(0, npcPoint.x);
      anim.set_initPos(2, npcPoint.y);
      anim.set_startPos(0, newSrc.x);
      anim.set_startPos(2, newSrc.y);
      anim.set_endPos(0, newDst.x);
      anim.set_endPos(2, newDst.y);
      anim.set_t(0);
      anim.set_tmid(npcPoint.distanceTo(newSrc) / npc.getMaxSpeed());
      anim.set_tmax(anim.tmid + (Vect.from(newSrc).distanceTo(newDst) / npc.getMaxSpeed()));

      return { src: newSrc, dst: newDst };
    },
    removeFromSensors(npcKey) {
      const closeDoors = state.npcToDoors[npcKey];
      for (const gdKey of closeDoors?.nearby ?? []) {// npc may never have been close to any door
        const door = w.door.byKey[gdKey];
        state.onExitDoorCollider({ key: 'exit-collider', type: 'nearby', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
      }
      state.npcToDoors[npcKey]?.nearby.clear();
    },
    revokeNpcAccess(npcKey, regexDef) {
      (state.npcToAccess[npcKey] ??= new Set()).delete(regexDef);
    },
    say(npcKey, ...parts) {// ensure/change/delete
      const cm = w.bubble.get(npcKey) || w.bubble.create(npcKey);
      const speechWithLinks = parts.join(' ').trim();
      const speechSansLinks = speechWithLinks.replace(globalLoggerLinksRegex, '$1');

      if (speechWithLinks === '') {// delete
        w.bubble.delete(npcKey);
      } else {// change
        cm.open = true;
        cm.speech = speechSansLinks;
        cm.update();
      }

      w.events.next({ key: 'speech', npcKey, speech: speechWithLinks });
    },
    showDefaultContextMenu() {
      const { lastDown } = w.view;
      if (lastDown === undefined) {
        return;
      } else if ('npcKey' in lastDown.meta) {
        const { npcKey } = lastDown.meta;
        w.cm.setTracked(w.n[npcKey].m.group);
        w.debug.setPickIndicator();
        w.cm.setContext(lastDown);
        w.cm.show();
      } else {
        w.cm.setTracked();
        w.debug.setPickIndicator(lastDown);
        w.cm.setContext(lastDown);
        w.cm.show();
      }
    },
    someNpcNearDoor(gdKey) {
      return state.doorToNearbyNpcs[gdKey]?.size > 0;
    },
    stopFollowing() {
      w.view.clearTarget();
    },
    toggleDoor(gdKey, opts) {
      const door = w.door.byKey[gdKey];

      // clear if already closed and offMeshConnection free
      opts.clear = door.open === false || !(state.doorToOffMesh[gdKey]?.length > 0);
      
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
 * @property {{ [gdKey: Geomorph.GmDoorKey]: Set<string> }} doorToNearbyNpcs
 * Relates `Geomorph.GmDoorKey` to nearby/inside `npcKey`s
 * @property {{ [gdKey: Geomorph.GmDoorKey]: NPC.OffMeshState[] }} doorToOffMesh
 * Mapping from doors to in-progress offMeshConnection traversals.
 * @property {Set<string>} externalNpcs
 * `npcKey`s not inside any room
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Relates `npcKey` to strings defining RegExp's matching `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: { inside: null | Geomorph.GmDoorKey; nearby: Set<Geomorph.GmDoorKey> }}} npcToDoors
 * Relate `npcKey` to (a) doorway we're inside, (b) nearby `Geomorph.GmDoorKey`s
 * @property {Map<string, Geomorph.GmRoomId>} npcToRoom npcKey to gmRoomId
 * Relates `npcKey` to current room, unless in a doorway (offMeshConnection)
 * @property {((lastDownMeta: Meta) => boolean)[]} pressMenuFilters
 * Prevent ContextMenu on long press if any of these return `true`.
 * @property {{[roomId: number]: Set<string>}[]} roomToNpcs
 * The "inverse" of npcToRoom i.e. `roomToNpc[gmId][roomId]` is a set of `npcKey`s
 *
 * @property {(door: Geomorph.DoorState) => boolean} canCloseDoor
 * @property {(npc: NPC.NPC) => void} clearOffMesh
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcCanAccess
 * @property {(r: number, g: number, b: number, a: number) => null | NPC.DecodedObjectPick} decodeObjectPick
 * @property {(npcKey: string) => void} followNpc
 * @property {(e: React.PointerEvent<Element>, decoded: NPC.DecodedObjectPick) => null | { intersection: THREE.Intersection; mesh: THREE.Mesh }} getRaycastIntersection
 * @property {(npcKey: string, regexDef: string) => void} grantNpcAccess
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(e: Extract<NPC.Event, { key: 'enter-collider'; type: 'nearby' }>) => void} onEnterDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'enter-off-mesh' }>, npc: NPC.NPC) => void} onEnterOffMeshConnection
 * @property {(e: Extract<NPC.Event, { key: 'enter-off-mesh-main' }>, npc: NPC.NPC) => void} onEnterOffMeshConnectionMain
 * @property {(e: Extract<NPC.Event, { key: 'exit-collider'; type: 'nearby' }>) => void} onExitDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'exit-off-mesh' }>, npc: NPC.NPC) => void} onExitOffMeshConnection
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcNearDoor
 * @property {(e: NPC.PointerUpEvent) => void} onPointerUpMenuDesktop
 * @property {(npc: NPC.NPC, offMesh: NPC.OffMeshLookupValue, door: Geomorph.DoorState) => { src: Geom.VectJson; dst: Geom.VectJson }} overrideOffMeshConnectionAngle
 * Improve offMeshConnection by varying src/dst, leading to a more natural walking angle.
 * @property {(npcKey: string) => void} removeFromSensors
 * @property {() => void} showDefaultContextMenu
 * Default context menu, unless clicked on an npc
 * @property {(npcKey: string, regexDef: string) => void} revokeNpcAccess
 * @property {(npcKey: string, ...parts: string[]) => void} say
 * @property {(gdKey: Geomorph.GmDoorKey) => boolean} someNpcNearDoor
 * @property {() => void} stopFollowing
 * @property {(gdKey: Geomorph.GmDoorKey, opts: { npcKey?: string; } & Geomorph.ToggleDoorOpts) => boolean} toggleDoor
 * Returns `true` iff successful.
 * @property {(gdKey: Geomorph.GmDoorKey, opts: { npcKey?: string; point?: Geom.VectJson; } & Geomorph.ToggleLockOpts) => boolean} toggleLock
 * Returns `true` iff successful.
 * @property {(gmId: number, doorId: number, eventMeta?: Meta) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {(npc: NPC.NPC) => void} tryPutNpcIntoRoom
 */

/** e.g. `'^g0'` -> `/^g0/` */
const regexCache = /** @type {Record<string, RegExp>} */ ({});
const tmpVect1 = new Vect();
