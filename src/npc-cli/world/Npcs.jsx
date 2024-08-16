import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

import { defaultSkinKey, glbMeta } from "../service/const";
import { info, warn } from "../service/generic";
import { createDebugBox, createDebugCylinder, tmpVectThree1, yAxis } from "../service/three";
import { helper } from "../service/helper";
import { Npc, hotModuleReloadNpc } from "./npc";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Npcs(props) {
  const w = React.useContext(WorldContext);

  const gltf = useGLTF(glbMeta.url);

  const state = useStateRef(/** @returns {State} */ () => ({
    group: /** @type {*} */ (null),
    nextObstacleId: 0,
    npc: {},
    obstacle: {},
    obsGroup: /** @type {*} */ (null),
    select: { curr: null, prev: null, many: [] },

    addBoxObstacle(position, extent, angle) {
      const { obstacle, success } = w.nav.tileCache.addBoxObstacle(position, extent, angle);
      state.updateTileCache();
      if (success) {
        const id = state.nextObstacleId++;
        const mesh = createDebugBox(position, obstacle.extent); // 🚧 angle
        state.obsGroup.add(mesh);
        return state.obstacle[id] = { id, o: obstacle, mesh };
      } else {
        warn(`failed to add obstacle (box) at ${JSON.stringify(position)}`);
        return null;
      }
    },
    addCylinderObstacle(position, radius, height) {
      const { obstacle, success } = w.nav.tileCache.addCylinderObstacle(position, radius, height);
      state.updateTileCache();
      if (success) {
        const id = state.nextObstacleId++;
        const mesh = createDebugCylinder(position, radius, height);
        state.obsGroup.add(mesh);
        return state.obstacle[id] = { id, o: obstacle, mesh };
      } else {
        warn(`failed to add obstacle (cylinder) at ${JSON.stringify(position)}`);
        return null;
      }
    },
    findPath(src, dst) {// 🔔 agent may follow different path
      const query = w.crowd.navMeshQuery;
      const { path, success } = query.computePath(src, dst, {
        filter: w.crowd.getFilter(0),
      });
      if (success === false) {
        warn(`${'findPath'} failed: ${JSON.stringify({ src, dst })}`);
      }
      return success === false || path.length === 0 ? null : path;
    },
    getClosestNavigable(p, maxDelta = 0.01) {
      const { success, point: closest } = w.crowd.navMeshQuery.findClosestPoint(p);
      if (success === false) {
        warn(`${'getClosestNavigable'} failed: ${JSON.stringify(p)}`);
      }
      return success === true && tmpVectThree1.copy(closest).distanceTo(p) < maxDelta ? closest : null;
    },
    getNpc(npcKey, processApi) {
      const npc = processApi === undefined
        ? state.npc[npcKey]
        : undefined // 🚧 state.connectNpcToProcess(processApi, npcKey);
      ;
      if (npc === undefined) {
        throw Error(`npc "${npcKey}" does not exist`);
      } else {
        return npc;
      }
    },
    isPointInNavmesh(p) {
      const { success } = w.crowd.navMeshQuery.findClosestPoint(p, { halfExtents: { x: 0, y: 0.1, z: 0 } });
      return success;
    },
    onNpcPointerDown(e) {
      const npcKey = /** @type {string} */ (e.object.userData.npcKey);
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerdown",
        event: e,
        is3d: true,
        meta: { npc: true, npcKey },
      }));
      e.stopPropagation();
    },
    onNpcPointerUp(e) {
      const npcKey = /** @type {string} */ (e.object.userData.npcKey);
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerup",
        event: e,
        is3d: true,
        meta: { npc: true, npcKey },
      }));
      e.stopPropagation();
    },
    onTick(deltaMs) {
      const npcs = Object.values(state.npc);
      const npcPositions = /** @type {number[]} */ ([]);

      for (const npc of npcs) {
        npc.onTick(deltaMs);
        if (npc.s.moving === true) {
          const { x, y, z } = npc.group.position;
          npcPositions.push(npc.bodyUid, x, y, z);
        }
      }

      // 🔔 Float32Array caused issues i.e. decode failed
      const positions = new Float64Array(npcPositions);
      w.physics.worker.postMessage({ type: 'send-npc-positions', positions }, [positions.buffer]);
    },
    removeObstacle(obstacleId) {
      const obstacle = state.obstacle[obstacleId];
      if (obstacle) {
        delete state.obstacle[obstacleId];
        w.nav.tileCache.removeObstacle(obstacle.o);
        state.obsGroup.remove(obstacle.mesh);
        state.updateTileCache();
      }
    },
    restore() {// onchange nav-mesh
      // restore agents
      Object.values(state.npc).forEach(npc => {
        npc.removeAgent();
        const agent = npc.attachAgent();
        
        const closest = state.getClosestNavigable(npc.getPosition());
        if (closest === null) {// Agent outside nav keeps target but `Idle`s 
          npc.startAnimation('Idle');
        } else if (npc.s.target !== null) {
          npc.moveTo(npc.s.target);
        } else {// so they'll move "out of the way" of other npcs
          agent.requestMoveTarget(npc.getPosition());
        }
      });

      // restore obstacles (overwrite)
      Object.values(state.obstacle).forEach(obstacle => {
        if (obstacle.o.type === 'box') {
          state.addBoxObstacle(obstacle.o.position, obstacle.o.extent, 0);
        } else {
          state.addCylinderObstacle(obstacle.o.position, obstacle.o.radius, obstacle.o.height);
        }
      });
    },
    removeNpc(npcKey) {
      const npc = state.getNpc(npcKey); // throw if n'exist pas
      // npc.setGmRoomId(null);
      delete state.npc[npcKey];
      npc.removeAgent();
      state.group.remove(npc.group);
      // if (state.playerKey === npcKey) {
      //   state.npcAct({ action: 'set-player', npcKey: undefined });
      // }
      w.events.next({ key: 'removed-npc', npcKey });
    },
    async spawn(e) {
      if (!(e.npcKey && typeof e.npcKey === 'string' && e.npcKey.trim())) {
        throw Error(`invalid npc key: ${JSON.stringify(e.npcKey)}`);
      } else if (!(e.point && typeof e.point.x === 'number' && typeof e.point.z === 'number')) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (e.requireNav && state.getClosestNavigable(e.point) === null) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (e.skinKey && !w.lib.isSkinKey(e.skinKey)) {
        throw Error(`invalid skinKey: ${JSON.stringify(e.skinKey)}`);
      }
      
      let npc = state.npc[e.npcKey];

      if (npc) {// Respawn
        await npc.cancel();
        npc.epochMs = Date.now();

        npc.def = {
          key: e.npcKey,
          angle: e.angle ?? npc.getAngle() ?? 0, // prev angle fallback
          skinKey: e.skinKey ?? npc.def.skinKey,
          position: e.point, // 🚧 remove?
          runSpeed: e.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? helper.defaults.walkSpeed,
        };
        if (typeof e.skinKey === 'string') {
          npc.changeSkin(e.skinKey);
        }
        // Reorder keys
        delete state.npc[e.npcKey];
        state.npc[e.npcKey] = npc;
      } else {
        // Spawn
        npc = state.npc[e.npcKey] = new Npc({
          key: e.npcKey,
          angle: e.angle ?? 0,
          skinKey: e.skinKey ?? defaultSkinKey,
          position: e.point,
          runSpeed: e.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? helper.defaults.walkSpeed,
        }, w);

        npc.initialize(gltf);
        npc.startAnimation('Idle');
        state.group.add(npc.group);
      }
      
      if (npc.agent !== null) {
        if (e.agent === false) {
          npc.removeAgent();
        } else {
          npc.agent.teleport(e.point);
          npc.startAnimation('Idle');
        }
      } else {
        npc.setPosition(e.point);
        this.group.setRotationFromAxisAngle(yAxis, npc.def.angle);
        // pin to current position, so "moves out of the way"
        e.agent && npc.attachAgent().requestMoveTarget(e.point);
      }

      npc.s.spawns++;
      w.events.next({ key: 'spawned', npcKey: npc.key });
      // state.npc[e.npcKey].doMeta = e.meta?.do ? e.meta : null;
      return npc;
    },

    // 🚧 old below
    updateTileCache() {// 🚧 spread out updates
      const { tileCache, navMesh } = w.nav;
      for (let i = 0; i < 5; i++) if (tileCache.update(navMesh).upToDate) break;
      console.log(`updateTileCached: ${tileCache.update(navMesh).upToDate}`);
    },
  }));

  w.npc = state;

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      info('hot-reloading npcs');
      Object.values(state.npc).forEach(npc =>
        state.npc[npc.key] = hotModuleReloadNpc(npc)
      );
    }
  }, []);

  return <>

    <group
      name="nav-obstacles"
      ref={x => state.obsGroup = x ?? state.obsGroup}
    />
  
    <group
      name="npcs"
      ref={x => state.group = x ?? state.group}
      onPointerDown={state.onNpcPointerDown}
      onPointerUp={state.onNpcPointerUp}
    />

  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.Group} group
 * @property {THREE.Group} obsGroup
 * @property {{ [npcKey: string]: Npc }} npc
 * @property {{ curr: null | string; prev: null | string; many: string[]; }} select 🚧 move to script
 * @property {number} nextObstacleId
 * @property {Record<string, NPC.Obstacle>} obstacle
 *
 * @property {(position: THREE.Vector3Like, extent: THREE.Vector3Like, angle: number) => NPC.Obstacle | null} addBoxObstacle
 * @property {(position: THREE.Vector3Like, radius: number, height: number) => NPC.Obstacle | null} addCylinderObstacle
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {(npcKey: string, processApi?: any) => NPC.NPC} getNpc
 * Throws if does not exist
 * 🚧 any -> ProcessApi (?)
 * @property {(p: THREE.Vector3Like, maxDelta?: number) => null | THREE.Vector3Like} getClosestNavigable
 * @property {(p: THREE.Vector3Like) => boolean} isPointInNavmesh
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerUp
 * @property {() => void} restore
 * @property {(deltaMs: number) => void} onTick
 * @property {(obstacleId: number) => void} removeObstacle
 * @property {(npcKey: string) => void} removeNpc
 * @property {(e: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * @property {() => void} updateTileCache
 */

useGLTF.preload(glbMeta.url);
