import React from "react";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { info } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";

/**
 * Based on:
 * https://github.com/pmndrs/ecctrl/blob/main/src/Ecctrl.tsx
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacterController = React.forwardRef(function TestCharacterController(
  { capsuleHalfHeight = 0.35, capsuleRadius = 0.3, children, position },
  ref
) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      onCollisionEnter(payload) {
        info("onCollisionEnter", payload);
      },
      onCollisionExit(payload) {
        info("onCollisionExit", payload);
      },
      rigidBody: /** @type {*} */ (null),
    })
  );

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

  return (
    <RigidBody
      type="kinematicPosition"
      ref={(rigidBody) => rigidBody && (state.rigidBody = rigidBody)}
      colliders={false}
      position={position || [0, capsuleHalfHeight + 0.1, 0]}
      onCollisionEnter={state.onCollisionEnter}
      onCollisionExit={state.onCollisionExit}
    >
      <CapsuleCollider
        name="character-capsule-collider"
        args={[capsuleHalfHeight, capsuleRadius]}
      />
      <group>
        <mesh name="debug-character-mesh" visible={true}>
          <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2]} />
          <meshStandardMaterial color="blue" />
        </mesh>
        {children}
      </group>
    </RigidBody>
  );
});

/**
 * @typedef {BaseProps & import("@react-three/rapier").RigidBodyProps} Props
 */

/**
 * @typedef BaseProps
 * @property {number} [capsuleHalfHeight]
 * @property {number} [capsuleRadius]
 */

/**
 * @typedef State
 * @property {import("@react-three/rapier").CollisionEnterHandler} onCollisionEnter
 * @property {import("@react-three/rapier").CollisionExitHandler} onCollisionExit
 * @property {import("@react-three/rapier").RapierRigidBody} rigidBody
 */
