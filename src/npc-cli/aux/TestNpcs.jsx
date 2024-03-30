import React from "react";
import * as THREE from "three";

import { wallOutset, worldScale } from "../service/const";
import { info } from "../service/generic";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function TestNpcs(props) {
  const api = React.useContext(TestWorldContext);

  // prettier-ignore
  const state = useStateRef(/** @returns {State} */ () => ({
    selected: 0,
    toAgent: {},
    toMesh: {}, // 🚧 on remove agent need to update this
    moveMesh(agent, mesh) {
      const position = agent.position();
      mesh.position.set(position.x, position.y + agentHeight/2, position.z);

      // 🚧 lerp angle
      const velocity = agent.velocity();
      mesh.lookAt(tmpVector3.copy(mesh.position).add(velocity));
    },
    update() {
      for (const agent of api.crowd.getAgents()) {
        const mesh = state.toMesh[agent.agentIndex];
        state.moveMesh(agent, mesh);
      }
    },
    updateAgentColor(agentId) {
      const mesh = state.toMesh[agentId];
      /** @type {THREE.MeshBasicMaterial} */ (mesh.material).color = state.selected === agentId ? greenColor : redColor
    },
  }));

  state.toAgent = props.crowd.agents;
  api.npcs = state;

  React.useEffect(() => {
    api.timer.reset();
    if (api.disabled) {
      cancelAnimationFrame(api.reqAnimId);
    } else {
      api.updateCrowd();
    }
  }, [api.disabled, props.crowd]);

  return Object.values(state.toAgent).map((agent) => (
    <mesh
      key={agent.agentIndex}
      onUpdate={(mesh) => {
        state.toMesh[agent.agentIndex] = mesh;
        state.moveMesh(agent, mesh);
        state.updateAgentColor(Number(agent.agentIndex));
      }}
      onPointerUp={(e) => {
        info("clicked npc", agent.agentIndex);
        state.selected = agent.agentIndex;
        Object.keys(state.toMesh).forEach((agentIdStr) =>
          state.updateAgentColor(Number(agentIdStr))
        );
        e.stopPropagation();
      }}
    >
      <meshBasicMaterial />
      <capsuleGeometry args={[agentRadius, agentHeight / 2, 5, 5]} />
    </mesh>
  ));
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {import("@recast-navigation/core").Crowd} crowd
 */

/**
 * @typedef State
 * @property {number} selected
 * @property {Record<string, NPC.CrowdAgent>} toAgent
 * @property {Record<string, THREE.Mesh>} toMesh
 * @property {(agentId: number) => void} updateAgentColor
 * @property {(agent: NPC.CrowdAgent, mesh: THREE.Mesh) => void} moveMesh
 * @property {() => void} update
 */

const agentRadius = wallOutset * worldScale;
const agentHeight = 1.5;
const tmpVector3 = new THREE.Vector3();
const redColor = new THREE.Color("red");
const greenColor = new THREE.Color("green");
