import React from "react";
import * as THREE from "three";
import { dampLookAt } from "maath/easing";

import { agentRadius } from "../service/const";
import { info, warn } from "../service/generic";
import { tmpMesh1 } from "../service/three";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function TestNpcs(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    selected: 0,
    nextObstacleId: 0,
    toAgent: {},
    toObstacle: {},
    toAgentGroup: {},

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
    updateTileCache() {
      // 🚧 spread out updates
      const { tileCache, navMesh } = api.nav;
      for (let i = 0; i < 5; i++) if (tileCache.update(navMesh).upToDate) break;
      console.log(`updateTileCached: ${tileCache.update(navMesh).upToDate}`);
    },
  }));

  state.toAgent = api.crowd.agents;
  api.npcs = state;

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

  return <>
  
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
  
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {number} selected Selected agent
 * @property {number} nextObstacleId
 * @property {Record<string, NPC.CrowdAgent>} toAgent
 * @property {Record<string, NPC.Obstacle>} toObstacle
 * @property {Record<string, THREE.Group>} toAgentGroup
 * @property {(agent: NPC.CrowdAgent, e: import("@react-three/fiber").ThreeEvent<PointerEventInit>) => void} onClickNpc
 * @property {() => void} onTick
 * @property {(position: THREE.Vector3Like, extent: THREE.Vector3Like, angle: number) => NPC.Obstacle | null} addBoxObstacle
 * @property {(agent: NPC.CrowdAgent, group: THREE.Group | null) => void} agentRef
 * @property {(agent: NPC.CrowdAgent, group: THREE.Group) => void} moveGroup
 * @property {(obstacleId: number) => void} removeObstacle
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
