import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

import { defaultNpcClassKey, glbMeta } from "../service/const";
import { info, warn } from "../service/generic";
import { createDebugBox, createDebugCylinder, tmpVectThree1, yAxis } from "../service/three";
import { npcService } from "../service/npc";
import { Npc, hotModuleReloadNpc } from "./create-npc";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Npcs(props) {
  const api = React.useContext(WorldContext);

  const gltf = useGLTF(glbMeta.url);

  const state = useStateRef(/** @returns {State} */ () => ({
    group: /** @type {*} */ (null),
    obsGroup: /** @type {*} */ (null),
    npc: {},
    select: { curr: null, prev: null, many: [] },

    nextObstacleId: 0,
    obstacle: {},

    findPath(src, dst) {// 🔔 agent may follow different path
      const query = api.crowd.navMeshQuery;
      const { path, success } = query.computePath(src, dst, {
        filter: api.crowd.getFilter(0),
      });
      if (success === false) {
        warn(`${'findPath'} failed: ${JSON.stringify({ src, dst })}`);
      }
      return success === false || path.length === 0 ? null : path;
    },
    getClosestNavigable(p, maxDelta = 0.01) {
      const { success, point: closest } = api.crowd.navMeshQuery.findClosestPoint(p);
      if (success === false) {
        warn(`${'getClosestNavigable'} failed: ${JSON.stringify(p)}`);
      }
      return success === true && tmpVectThree1.copy(closest).distanceTo(p) < maxDelta ? closest : null;
    },
    getSelected() {
      const npcKey = state.select.curr;
      return npcKey === null ? null : (state.npc[npcKey] ?? null);
    },
    isPointInNavmesh(p) {
      const { success } = api.crowd.navMeshQuery.findClosestPoint(p);
      return success;
    },
    async spawn(e) {
      if (!(e.npcKey && typeof e.npcKey === 'string' && e.npcKey.trim())) {
        throw Error(`invalid npc key: ${JSON.stringify(e.npcKey)}`);
      } else if (!(e.point && typeof e.point.x === 'number' && typeof e.point.z === 'number')) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (e.requireNav && state.getClosestNavigable(e.point) === null) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (e.npcClassKey && !api.lib.isNpcClassKey(e.npcClassKey)) {
        throw Error(`invalid npcClassKey: ${JSON.stringify(e.npcClassKey)}`);
      }
      
      let npc = state.npc[e.npcKey];

      if (npc) {// Respawn
        await npc.cancel();
        npc.epochMs = Date.now();

        npc.def = {
          key: e.npcKey,
          angle: e.angle ?? npc.getAngle() ?? 0, // prev angle fallback
          classKey: e.npcClassKey ?? npc.def.classKey,
          position: e.point, // 🚧 remove?
          runSpeed: e.runSpeed ?? npcService.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? npcService.defaults.walkSpeed,
        };
        if (typeof e.npcClassKey === 'string') {
          npc.changeClass(e.npcClassKey);
        }
        // Reorder keys
        delete state.npc[e.npcKey];
        state.npc[e.npcKey] = npc;
      } else {
        // Spawn
        const npcClassKey = e.npcClassKey ?? defaultNpcClassKey;
        npc = state.npc[e.npcKey] = new Npc({
          key: e.npcKey,
          angle: e.angle ?? 0,
          classKey: npcClassKey,
          position: e.point,
          runSpeed: e.runSpeed ?? npcService.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? npcService.defaults.walkSpeed,
        }, api);

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
      api.events.next({ key: 'spawned', npcKey: npc.key });
      // state.npc[e.npcKey].doMeta = e.meta?.do ? e.meta : null;
      return npc;
    },
    onClickNpcs(e) {
      // console.log(e);
      const npcKey = /** @type {string} */ (e.object.userData.npcKey);
      const npc = state.npc[npcKey];
      info(`clicked npc: ${npc.key}`);
      state.select.curr = npc.key;
      // 🚧 indicate selected npc somehow
      e.stopPropagation();
    },
    onTick(deltaMs) {
      for (const npc of Object.values(state.npc)) {
        npc.onTick(deltaMs);
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
          npc.walkTo(npc.s.target);
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

    addBoxObstacle(position, extent, angle) {
      const { obstacle, success } = api.nav.tileCache.addBoxObstacle(position, extent, angle);
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
      const { obstacle, success } = api.nav.tileCache.addCylinderObstacle(position, radius, height);
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
    removeObstacle(obstacleId) {
      const obstacle = state.obstacle[obstacleId];
      if (obstacle) {
        delete state.obstacle[obstacleId];
        api.nav.tileCache.removeObstacle(obstacle.o);
        state.obsGroup.remove(obstacle.mesh);
        state.updateTileCache();
      }
    },

    // 🚧 old below
    updateTileCache() {// 🚧 spread out updates
      const { tileCache, navMesh } = api.nav;
      for (let i = 0; i < 5; i++) if (tileCache.update(navMesh).upToDate) break;
      console.log(`updateTileCached: ${tileCache.update(navMesh).upToDate}`);
    },
  }));

  api.npc = state;

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
      name="obstacles"
      ref={x => state.obsGroup = x ?? state.obsGroup}
    />
  
    <group
      name="npcs"
      ref={x => state.group = x ?? state.group}
      onPointerUp={e => state.onClickNpcs(e)}
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
 * @property {{ curr: null | string; prev: null | string; many: string[]; }} select
 * @property {number} nextObstacleId
 * @property {Record<string, NPC.Obstacle>} obstacle
 *
 * @property {(position: THREE.Vector3Like, extent: THREE.Vector3Like, angle: number) => NPC.Obstacle | null} addBoxObstacle
 * @property {(position: THREE.Vector3Like, radius: number, height: number) => NPC.Obstacle | null} addCylinderObstacle
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {() => null | NPC.NPC} getSelected
 * @property {(p: THREE.Vector3Like, maxDelta?: number) => null | THREE.Vector3Like} getClosestNavigable
 * @property {(p: THREE.Vector3Like) => boolean} isPointInNavmesh
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEventInit>) => void} onClickNpcs
 * @property {() => void} restore
 * @property {(deltaMs: number) => void} onTick
 * @property {(obstacleId: number) => void} removeObstacle
 * @property {(e: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * @property {() => void} updateTileCache
 */

useGLTF.preload(glbMeta.url);
