import React from "react";
import useStateRef from "../hooks/use-state-ref";
import { useFBX } from "@react-three/drei";

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

  const fbx = useFBX('/assets/fbx/base-mesh-246-tri.fbx');

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

  return (
    <group>
      <primitive scale={0.01} object={fbx} />
      {/* <mesh name="debug-character-mesh" visible={true}>
        <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2]} />
        <meshStandardMaterial color="blue" />
      </mesh> */}
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
