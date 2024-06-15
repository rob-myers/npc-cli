import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

import { defaultNpcClassKey, glbMeta } from "../service/const";
import { info, warn } from "../service/generic";
import { tmpMesh1, tmpVectThree1, yAxis } from "../service/three";
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
    npc: {},
    select: { curr: null, prev: null, many: [] },

    nextObstacleId: 0,
    toObstacle: {},

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

    // 🚧 old below
    addBoxObstacle(position, extent, angle) {
      const { obstacle } = api.nav.tileCache.addBoxObstacle(position, extent, angle);
      state.updateTileCache();
      const id = state.nextObstacleId++;
      if (obstacle) {
        return state.toObstacle[id] = { id, o: obstacle, mesh: tmpMesh1 };
      } else {
        warn(`failed to add obstacle at ${JSON.stringify(position)}`);
        return null;
      }
    },
    removeObstacle(obstacleId) {
      const obstacle = state.toObstacle[obstacleId];
      if (obstacle) {
        delete state.toObstacle[obstacleId];
        api.nav.tileCache.removeObstacle(obstacle.o);
        state.updateTileCache();
      }
    },
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

    {/* 🚧 <group name="obstacles"> */}
    {Object.values(state.toObstacle).map((o) => (
      <mesh
        key={o.id}
        ref={mesh => mesh && (o.mesh = mesh)}
        position={[o.o.position.x, o.o.position.y, o.o.position.z]}
      >
        <meshBasicMaterial wireframe color="red" />
        {o.o.type === 'box'
          ? <boxGeometry args={[o.o.extent.x * 2, o.o.extent.y * 2, o.o.extent.z * 2]} />
          : <cylinderGeometry args={[o.o.radius, o.o.radius, o.o.height]} />
        }
      </mesh>
    ))}
  
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
 * @property {{ [npcKey: string]: Npc }} npc
 * @property {{ curr: null | string; prev: null | string; many: string[]; }} select
 * @property {number} nextObstacleId
 * @property {Record<string, NPC.Obstacle>} toObstacle
 *
 * @property {(position: THREE.Vector3Like, extent: THREE.Vector3Like, angle: number) => NPC.Obstacle | null} addBoxObstacle
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {() => null | NPC.NPC} getSelected
 * @property {(p: THREE.Vector3Like, maxDelta?: number) => null | THREE.Vector3Like} getClosestNavigable
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEventInit>) => void} onClickNpcs
 * @property {(deltaMs: number) => void} onTick
 * @property {(obstacleId: number) => void} removeObstacle
 * @property {(e: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * @property {() => void} updateTileCache
 */

useGLTF.preload(glbMeta.url);
