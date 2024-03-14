import React from "react";

/**
 * @typedef {import('./TestCanvas').State<{ scene: State }>} Api
 */
export function Origin() {
  return (
    <mesh scale={[0.025, 0, 0.025]} position={[0, 0.0001, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}
