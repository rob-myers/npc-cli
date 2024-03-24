import React from "react";

/**
 * @typedef {import('./TestCanvas').State<{ scene: State }>} Api
 */
export function Origin() {
  return (
    <mesh scale={[0.025, 1, 0.025]} position={[0, 0.5 - 0.001, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}
