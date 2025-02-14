import React from 'react';
import { init as initRecastNav, importTileCache, Crowd } from "@recast-navigation/core";

import { isDevelopment, warn, debug, testNever, info } from '../service/generic';
import { parsePhysicsBodyKey } from '../service/rapier';
import { computeOffMeshConnectionsParams, disposeCrowd, getTileCacheMeshProcess } from '../service/recast-detour';
import { helper } from '../service/helper';
import { WorldContext } from './world-context';
import useStateRef from '../hooks/use-state-ref';

/**
 * This component helps with HMR:
 * - avoid reloading the nav-mesh e.g. on edit World.jsx
 * - restart workers on edit handler (edit this file)
 * - restart workers on edit worker (via useless import)
 */
export default function WorldWorkers() {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    seenHash: /** @type {*} */ ({}),

    // 🔔 compute each offMeshLookup[i].{srcGrKey,dstGrKey,dstRoomMeta}
    // 🔔 compute "aligned" i.e. whether normal points towards src
    postProcessNavResponse(msg) {
      for (const value of Object.values(msg.offMeshLookup)) {
        const door = w.door.byKey[value.gdKey];
        /** Is the transformed door's normal pointing towards `value.src`? */
        const normalTowardsSrc = (
          (value.src.x - door.center.x) * door.normal.x +
          (value.src.z - door.center.y) * door.normal.y > 0
        );

        if (door.hull === true) {
          const adj = w.gmGraph.getAdjacentRoomCtxt(value.gmId, value.doorId);
          if (adj === null) {
            continue; // unreachable because offMeshConnection doesn't exist
          } else if (normalTowardsSrc === true) {// hull normal points outwards
            value.srcGrKey = adj.adjGmRoomKey;
            value.dstGrKey = `g${value.gmId}r${/** @type {number} */ (door.door.roomIds[1]) }`;
          } else {
            value.srcGrKey = `g${value.gmId}r${/** @type {number} */ (door.door.roomIds[1]) }`;
            value.dstGrKey = adj.adjGmRoomKey;
          }
        } else {// 🔔 non-hull doors always have roomIds [number, number] (?)
          const srcRoomId = /** @type {number} */ (door.door.roomIds[normalTowardsSrc === true ? 0 : 1]);
          const dstRoomId = /** @type {number} */ (door.door.roomIds[normalTowardsSrc === true ? 1 : 0]);
          value.srcGrKey = `g${value.gmId}r${srcRoomId}`;
          value.dstGrKey = `g${value.gmId}r${dstRoomId}`;
        }

        value.aligned = normalTowardsSrc;
        const { gmId, roomId } = helper.getGmRoomId(value.dstGrKey);
        value.dstRoomMeta = w.gms[gmId].rooms[roomId].meta;
      }
    },

    async handleNavWorkerMessage(e) {
      const msg = e.data;
      // 🔔 avoid logging navMesh to save memory
      debug(`main thread received "${msg.type}" from 🤖 nav.worker`);
      // console.log(msg);

      if (msg.type === "nav-mesh-response") {
        w.menu.measure('request-nav');
        await initRecastNav();
        state.postProcessNavResponse(msg);
        state.loadTiledMesh(msg);
        w.update(); // for w.npc
        w.events.next({ key: 'nav-updated' });
      }
    },

    handlePhysicsCollision(npcKey, otherKey, isEnter) {
      const [type, subKey] = parsePhysicsBodyKey(otherKey);

      if (type === 'npc') {
        warn(`${'handlePhysicsCollision'}: unexpected otherKey: "${otherKey}"`);
      } else {
        w.events.next({ key: isEnter === true ? 'enter-collider' : 'exit-collider', npcKey,
          ...type === 'nearby' 
            ? { type, ...w.lib.getGmDoorId(subKey) }
            : { type, decorKey: subKey }
        });
      }
    },

    async handlePhysicsWorkerMessage({ data: msg }) {
      debug(`main thread received "${msg.type}" from 🤖 physics.worker`, msg);

      if (msg.type === "npc-collisions") {
        msg.collisionEnd.forEach(({ npcKey, otherKey }) => {
          if (otherKey === undefined) {
            warn(`${npcKey}: ${'handlePhysicsWorkerMessage'} collider removed whilst colliding`);
            return;
          }
          state.handlePhysicsCollision(npcKey, otherKey, false);
        });
        msg.collisionStart.forEach(({ npcKey, otherKey }) => {
          state.handlePhysicsCollision(npcKey, otherKey, true);
        });
        return;
      }

      if (msg.type === 'physics-is-setup') {
        w.physics.rebuilds++;
        w.menu.measure('setup-physics');
      }
    },

    loadTiledMesh({ exportedNavMesh, offMeshLookup }) {
      const tiledCacheResult = /** @type {NPC.TiledCacheResult} */ (
        importTileCache(exportedNavMesh, getTileCacheMeshProcess(w.nav.offMeshDefs))
      );
      
      Object.assign(w.nav, tiledCacheResult);
      w.nav.offMeshLookup = offMeshLookup;
      w.nav.doorToOffMesh = Object.values(offMeshLookup).reduce((agg, v) => {
        (agg[v.gdKey] ??= []).push(v);
        return agg;
      }, /** @type {NPC.DoorToOffMeshLookup} */ ({}));


      if (w.crowd) {
        disposeCrowd(w.crowd, w.nav.navMesh);
      }
      w.crowd = new Crowd(w.nav.navMesh, {
        maxAgents: 200,
        // 🔔 maxAgentRadius influences m_agentPlacementHalfExtents
        // 🔔 maxAgentRadius influences proximity grid
        // https://github.com/recastnavigation/recastnavigation/blob/77f7e54bc8cf5a816f9f087a3e0ac391d2043be3/DetourCrowd/Source/DetourCrowd.cpp#L394
        maxAgentRadius: helper.defaults.radius,
        // maxAgentRadius: helper.defaults.radius * 0.5,
      });

      // const { adaptiveDepth, adaptiveDivs, adaptiveRings, gridSize, horizTime, velBias, weightCurVel, weightSide, weightToi } = w.crowd.raw.getObstacleAvoidanceParams(0);
      // info('dtObstacleAvoidanceParams', { adaptiveDepth, adaptiveDivs, adaptiveRings, gridSize, horizTime, velBias, weightCurVel, weightSide, weightToi });
      // 🚧 try modify dtObstacleAvoidanceParams
      // const oap = new RecastWasm.dtObstacleAvoidanceParams();
      
      w.npc?.restore();
    },
  }));

  React.useEffect(() => {// restart workers
    if (w.threeReady && w.hash.full) {
      w.nav.worker = new Worker(new URL("./nav.worker", import.meta.url), { type: "module" });
      w.nav.worker.addEventListener("message", state.handleNavWorkerMessage);

      w.physics.worker = new Worker(new URL("./physics.worker", import.meta.url), { type: "module" });
      w.physics.worker.addEventListener("message", state.handlePhysicsWorkerMessage);

      return () => {
        w.nav.worker.terminate();
        w.physics.worker.terminate();
      };
    }
  }, [w.threeReady, w.hash.full]);

  React.useEffect(() => {// request nav-mesh, fresh physics world
    if (w.threeReady && w.hash.full) {

      const prev = state.seenHash;
      const next = w.hash;
      const changedGmIds = w.gms.map(({ key }, gmId) =>
        next[key].nav !== prev[key]?.nav // geomorph changed
        || next.mapGmHashes[gmId] !== prev.mapGmHashes[gmId] // geomorph instance changed
      );
      
      w.nav.offMeshDefs = computeOffMeshConnectionsParams(w);
      w.events.next({ key: 'pre-request-nav', changedGmIds });
      w.menu.measure('request-nav');
      w.nav.worker.postMessage({ type: "request-nav", mapKey: w.mapKey, offMeshDefs: w.nav.offMeshDefs });

      w.events.next({ key: 'pre-setup-physics' });
      w.menu.measure('setup-physics');
      w.physics.worker.postMessage({
        type: "setup-physics",
        mapKey: w.mapKey, // On HMR must provide existing npcs:
        npcs: Object.values(w.npc?.npc ?? {}).map((npc) => ({
          npcKey: npc.key,
          position: npc.position,
        })),
      });

      state.seenHash = next;
    }
  }, [w.threeReady, w.mapKey, w.hash.full]); // 🚧 avoid rebuild when only image changes

  return null;
}

if (isDevelopment()) {// propagate HMR to this file onchange worker files
  import('./physics.worker');
  import('./nav.worker');
}

/**
 * @typedef State
 * @property {Geomorph.GeomorphsHash} seenHash
 * @property {(e: MessageEvent<WW.MsgFromNavWorker>) => Promise<void>} handleNavWorkerMessage
 * @property {(npcKey: string, otherKey: WW.PhysicsBodyKey, isEnter?: boolean) => void} handlePhysicsCollision
 * @property {(e: MessageEvent<WW.MsgFromPhysicsWorker>) => Promise<void>} handlePhysicsWorkerMessage
 * @property {(e: WW.NavMeshResponse) => void} loadTiledMesh
 * @property {(msg: WW.NavMeshResponse) => void} postProcessNavResponse
 */
