import React from "react";
import * as THREE from "three";
import { boxGeometry, quadGeometryXZ } from "../service/three";
import * as glsl from "../service/glsl";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/** @param {Props} props */
export default function Decor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    cuboidInst: /** @type {*} */ (null),
    decorCuboidCount: 0,
    decorQuadCount: 0,
    quadInst: /** @type {*} */ (null),

    onPointerDown(e) {
      // 🚧
    },
    onPointerUp(e) {
      // 🚧
    },
  }));

  w.decor = state;

  return <>
    <instancedMesh
      name="decor-cuboids"
      key={`${w.hash} ${state.decorCuboidCount} cuboids`}
      ref={instances => instances && (state.cuboidInst = instances)}
      args={[boxGeometry, undefined, state.decorCuboidCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      <meshBasicMaterial
        color="red" // 🚧
      />
    </instancedMesh>

    <instancedMesh
      name="decor-quads"
      key={`${w.hash} ${state.decorQuadCount} quads`}
      ref={instances => instances && (state.quadInst = instances)}
      args={[quadGeometryXZ, undefined, state.decorQuadCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        map={w.decorTex}
        transparent
      />
    </instancedMesh>
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.InstancedMesh} quadInst
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {number} decorCuboidCount Total number of decor cuboids
 * @property {number} decorQuadCount Total number of decor quads
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 */
