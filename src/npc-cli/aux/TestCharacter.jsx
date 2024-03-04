import React from "react";
import { CameraControls, Edges } from "@react-three/drei";

/**
 * @param {Props} props
 */
export default function TestCharacter(props) {
  console.log("TestCharacter received props", props);

  return (
    <>
      <CameraControls />
      <ambientLight intensity={1} />
      <mesh>
        <boxGeometry />
        <meshBasicMaterial color="red" />
        <Edges />
      </mesh>
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {string} testProp
 */
