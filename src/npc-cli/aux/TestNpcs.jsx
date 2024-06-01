import React from "react";
import * as THREE from "three";
import { dampLookAt } from "maath/easing";
import { useGLTF } from "@react-three/drei";

import { agentRadius, defaultNpcClassKey, glbMeta } from "../service/const";
import { info, warn } from "../service/generic";
import { tmpMesh1 } from "../service/three";
import { Npc, hotModuleReloadNpc } from "./create-npc";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function TestNpcs(props) {
  const api = React.useContext(TestWorldContext);

  const gltf = useGLTF(glbMeta.url);

  const state = useStateRef(/** @returns {State} */ () => ({
    group: /** @type {*} */ (null),
    npc: {},

    selected: 0,
    nextObstacleId: 0,
    toAgent: {},
    toObstacle: {},
    toAgentGroup: {},

    isPointInNavmesh(p) {
      const closest = api.crowd.navMeshQuery.getClosestPoint(tmpV3_1.set(p.x, 0, p.y));
      return closest.x === p.x && closest.z === p.y;
    },
    async spawn(e) {
      if (!(e.npcKey && typeof e.npcKey === 'string' && e.npcKey.trim())) {
        throw Error(`invalid npc key: ${JSON.stringify(e.npcKey)}`);
      } else if (!(e.point && typeof e.point.x === 'number' && typeof e.point.y === 'number')) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (e.requireNav && !state.isPointInNavmesh(e.point)) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (e.npcClassKey && !api.lib.isNpcClassKey(e.npcClassKey)) {
        throw Error(`invalid npcClassKey: ${JSON.stringify(e.npcClassKey)}`);
      }
      
      if (state.npc[e.npcKey]) {// Respawn
        const spawned = state.npc[e.npcKey];

        await spawned.cancel();
        spawned.epochMs = Date.now();

        spawned.def = {
          key: e.npcKey,
          angle: e.angle ?? spawned.getAngle() ?? 0, // prev angle fallback
          classKey: spawned.classKey,
          position: e.point,
          runSpeed: e.runSpeed ?? glbMeta.runSpeed,
          walkSpeed: e.walkSpeed ?? glbMeta.walkSpeed,
        };
        if (e.npcClassKey) {
          spawned.changeClass(e.npcClassKey);
        }
        // Reorder keys
        delete state.npc[e.npcKey];
        state.npc[e.npcKey] = spawned;
      } else {
        const npcClassKey = e.npcClassKey ?? defaultNpcClassKey;
        const npc = state.npc[e.npcKey] = new Npc({
          key: e.npcKey,
          angle: e.angle ?? 0,
          classKey: npcClassKey,
          position: e.point,
          runSpeed: e.runSpeed ?? glbMeta.runSpeed,
          walkSpeed: e.walkSpeed ?? glbMeta.walkSpeed,
        }, api);

        npc.initialize(gltf);
        npc.startAnimation('Idle');
        state.group.add(npc.group);
        api.events.next({ key: 'spawned-npc', npcKey: npc.key });
      }
      
      // state.npc[e.npcKey].doMeta = e.meta?.do ? e.meta : null;
      update();
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
    agentRef(agent, group) {
      if (group) {
        state.toAgentGroup[agent.agentIndex] = group;
        state.moveGroup(agent, group);
        state.updateAgentColor(Number(agent.agentIndex));
      } else {
        delete state.toAgentGroup[agent.agentIndex];
      }
    },
    moveGroup(agent, mesh) {
      const position = agent.position();
      mesh.position.set(position.x, position.y + agentHeight/2, position.z);

      const velocity = tmpV3_1.copy(agent.velocity());
      if (velocity.length() > 0.2) {
        dampLookAt(mesh, tmpV3_2.copy(mesh.position).add(velocity), 0.25, api.timer.getDelta());
      }
    },
    onClickNpc(agent, e) {
      info("clicked npc", agent.agentIndex);
      state.selected = agent.agentIndex;
      Object.keys(state.toAgentGroup).forEach((agentIdStr) =>
        state.updateAgentColor(Number(agentIdStr))
      );
      e.stopPropagation();
    },
    onTick() {
      for (const agent of api.crowd.getAgents()) {
        const mesh = state.toAgentGroup[agent.agentIndex];
        // 🚧 avoid issue on level change
        mesh !== undefined && state.moveGroup(agent, mesh);
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
    updateAgentColor(agentId) {
      const mesh = state.toAgentGroup[agentId].children[0];
      if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.color = state.selected === agentId ? greenColor : redColor
      }
    },
    updateTileCache() {// 🚧 spread out updates
      const { tileCache, navMesh } = api.nav;
      for (let i = 0; i < 5; i++) if (tileCache.update(navMesh).upToDate) break;
      console.log(`updateTileCached: ${tileCache.update(navMesh).upToDate}`);
    },
  }));

  state.toAgent = api.crowd.agents;
  api.npc = state;

  React.useEffect(() => {// 🚧 DEMO
    // create an obstacle (before query)
    const obstacle = state.addBoxObstacle({ x: 1 * 1.5, y: 0.5 + 0.01, z: 5 * 1.5 }, { x: 0.5, y: 0.5, z: 0.5 }, 0);

    // find and exclude a poly
    const { polyRefs } =  api.crowd.navMeshQuery.queryPolygons(
      // { x: (1 + 0.5) * 1.5, y: 0, z: 4 * 1.5  },
      // { x: (2 + 0.5) * 1.5, y: 0, z: 4 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      // { x: (3 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      { x: (3 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      { x: 0.2, y: 0.1, z: 0.01 },
    );
    console.log({ polyRefs });
    const filter = api.crowd.getFilter(0);
    filter.excludeFlags = 2 ** 0; // all polys should already be set differently
    polyRefs.forEach(polyRef => api.nav.navMesh.setPolyFlags(polyRef, 2 ** 0));

    // display via debug
    api.debug.selectNavPolys(polyRefs);

    api.update(); // Trigger ticker
    return () => void (obstacle && state.removeObstacle(obstacle.id));
  }, [api.crowd]); 

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      Object.values(state.npc).forEach(hotModuleReloadNpc);
    }
  }, []);

  const update = useUpdate();

  return <>
  
    {/* 🚧 remove */}
    {Object.values(state.toAgent).map((agent) => (
      <group
        key={agent.agentIndex}
        ref={group => state.agentRef(agent, group)}
      >
        <mesh onPointerUp={e => state.onClickNpc(agent, e)}>
          <meshBasicMaterial />
          <cylinderGeometry args={[agentRadius, agentRadius, agentHeight]} />
          {/* <capsuleGeometry args={[agentRadius, agentHeight / 2]} /> */}
        </mesh>
        <arrowHelper args={[tmpV3_unitZ, undefined, 0.7, "blue", undefined, 0.1]} />
      </group>
    ))}

    {/* 🚧 memoize */}
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
      name="NPCs"
      ref={x => state.group = x ?? state.group}
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
 * @property {number} selected Selected agent
 * @property {number} nextObstacleId
 * @property {Record<string, NPC.CrowdAgent>} toAgent
 * @property {Record<string, NPC.Obstacle>} toObstacle
 * @property {Record<string, THREE.Group>} toAgentGroup
 *
 * @property {(position: THREE.Vector3Like, extent: THREE.Vector3Like, angle: number) => NPC.Obstacle | null} addBoxObstacle
 * @property {(agent: NPC.CrowdAgent, group: THREE.Group | null) => void} agentRef
 * @property {(p: Geom.VectJson) => boolean} isPointInNavmesh
 * @property {(agent: NPC.CrowdAgent, group: THREE.Group) => void} moveGroup
 * @property {(agent: NPC.CrowdAgent, e: import("@react-three/fiber").ThreeEvent<PointerEventInit>) => void} onClickNpc
 * @property {() => void} onTick
 * @property {(obstacleId: number) => void} removeObstacle
 * @property {(e: NPC.SpawnOpts) => Promise<void>} spawn
 * @property {(agentId: number) => void} updateAgentColor
 * @property {() => void} updateTileCache
 */

const agentHeight = 1.5;
const tmpV3_1 = new THREE.Vector3();
const tmpV3_2 = new THREE.Vector3();
const tmpV3_unitX = new THREE.Vector3(1, 0, 0);
const tmpV3_unitZ = new THREE.Vector3(0, 0, 1);
const redColor = new THREE.Color("red");
const greenColor = new THREE.Color("green");

useGLTF.preload(glbMeta.url);
