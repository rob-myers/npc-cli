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
    toAgent: {},
    toMesh: {}, // 🚧 on remove agent need to update this
    moveMesh(agent, mesh) {
      const position = agent.position();
      mesh.position.set(position.x, position.y + agentHeight/2, position.z);
      mesh.lookAt(tmpVector3.copy(mesh.position).add(agent.velocity()));
    },
    update() {
      // 🚧
      for (const agent of api.crowd.getAgents()) {
        const mesh = state.toMesh[agent.agentIndex];
        state.moveMesh(agent, mesh);
      }
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
      }}
      onPointerUp={(e) => {
        info("clicked npc", agent.agentIndex);
      }}
    >
      <meshBasicMaterial color="blue" />
      <capsuleGeometry args={[agentRadius, agentHeight / 2]} />
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
 * @property {Record<string, NPC.CrowdAgent>} toAgent
 * @property {Record<string, THREE.Mesh>} toMesh
 * @property {(agent: NPC.CrowdAgent, mesh: THREE.Mesh) => void} moveMesh
 * @property {() => void} update
 */

const agentRadius = wallOutset * worldScale;
const agentHeight = 1.5;
const tmpVector3 = new THREE.Vector3();
