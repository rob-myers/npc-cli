import React from "react";
import * as THREE from "three";
import { dampLookAt, dampAngle } from "maath/easing";

import { wallOutset, worldScale } from "../service/const";
import { info } from "../service/generic";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function TestNpcs(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    selected: 0,
    toAgent: {},
    toGroup: {},
    toObstacle: new Map(),

    groupRef(agent, group) {
      if (group) {
        state.toGroup[agent.agentIndex] = group;
        state.moveGroup(agent, group);
        state.updateAgentColor(Number(agent.agentIndex));
      } else {
        delete state.toGroup[agent.agentIndex];
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
      Object.keys(state.toGroup).forEach((agentIdStr) =>
        state.updateAgentColor(Number(agentIdStr))
      );
      e.stopPropagation();
    },
    onTick() {
      for (const agent of api.crowd.getAgents()) {
        const mesh = state.toGroup[agent.agentIndex];
        state.moveGroup(agent, mesh);
      }
    },
    updateAgentColor(agentId) {
      const mesh = state.toGroup[agentId].children[0];
      if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.color = state.selected === agentId ? greenColor : redColor
      }
    },
  }));

  state.toAgent = api.crowd.agents;
  state.toObstacle = api.nav.tileCache.obstacles;
  api.npcs = state;

  React.useEffect(() => void api.update(), []); // Trigger ticker

  return <>
  
    {Object.values(state.toAgent).map((agent) => (
      <group
        key={agent.agentIndex}
        ref={group => state.groupRef(agent, group)}
      >
        <mesh onPointerUp={e => state.onClickNpc(agent, e)}>
          <meshBasicMaterial />
          <cylinderGeometry args={[agentRadius, agentRadius, agentHeight]} />
          {/* <capsuleGeometry args={[agentRadius, agentHeight / 2]} /> */}
        </mesh>
        <arrowHelper args={[tmpV3_unitZ, undefined, 0.7, "blue", undefined, 0.1]} />
      </group>
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
 * @property {Record<string, NPC.CrowdAgent>} toAgent
 * @property {Record<string, THREE.Group>} toGroup
 * @property {Map<import("@recast-navigation/core").ObstacleRef, NPC.CrowdObstacle>} toObstacle
 * @property {(agent: NPC.CrowdAgent, e: import("@react-three/fiber").ThreeEvent<PointerEventInit>) => void} onClickNpc
 * @property {() => void} onTick
 * @property {(agent: NPC.CrowdAgent, group: THREE.Group | null) => void} groupRef
 * @property {(agent: NPC.CrowdAgent, group: THREE.Group) => void} moveGroup
 * @property {(agentId: number) => void} updateAgentColor
 */

const agentRadius = wallOutset * worldScale;
const agentHeight = 1.5;
const tmpV3_1 = new THREE.Vector3();
const tmpV3_2 = new THREE.Vector3();
const tmpV3_unitX = new THREE.Vector3(1, 0, 0);
const tmpV3_unitZ = new THREE.Vector3(0, 0, 1);
const redColor = new THREE.Color("red");
const greenColor = new THREE.Color("green");
