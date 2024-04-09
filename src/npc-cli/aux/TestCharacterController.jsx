import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import useStateRef from "../hooks/use-state-ref";

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacterController = React.forwardRef(function TestCharacterController(
  { capsuleHalfHeight = 0.35, capsuleRadius = 0.3 },
  ref
) {
  const state = useStateRef(/** @returns {State} */ () => ({
    // 🚧
  }));

  const { scene: gltf } = useGLTF('/assets/fbx/base-mesh-246-tri.glb');

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

  React.useMemo(() => {
    gltf.traverse(x => {
      if (x instanceof THREE.Mesh && x.material instanceof THREE.MeshStandardMaterial) {
        x.material.metalness = 0;
      }
    })
  }, []);

  return (
    <group>
      <primitive object={gltf} />
    </group>
  );
});

/**
 * @typedef Props
 * @property {number} [capsuleHalfHeight]
 * @property {number} [capsuleRadius]
 */

/**
 * @typedef State
 * @property {'bar'} [foo]
 */
