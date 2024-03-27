import React from "react";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";

/**
 * Based on:
 * https://github.com/pmndrs/ecctrl/blob/main/src/Ecctrl.tsx
 * @param {Props & import("@react-three/rapier").RigidBodyProps} props
 */
export default function TestCharacterController({
  capsuleHalfHeight = 0.35,
  capsuleRadius = 0.3,
  children,
  position,
}) {
  return (
    <RigidBody
      type="kinematicPosition"
      colliders={false}
      position={position || [0, capsuleHalfHeight + 0.1, 0]}
    >
      <CapsuleCollider
        name="character-capsule-collider"
        args={[capsuleHalfHeight, capsuleRadius]}
      />
      <group>
        {/* 🚧 debug mesh */}
        <mesh>
          <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2]} />
          <meshStandardMaterial color="blue" />
        </mesh>
        {children}
      </group>
    </RigidBody>
  );
}

/**
 * @typedef Props
 * @property {number} [capsuleHalfHeight]
 * @property {number} [capsuleRadius]
 */
