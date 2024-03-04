import React from "react";
import { CameraControls, Edges } from "@react-three/drei";

/**
 * @param {Props} props 
 */
export default function TestWorkerScene(props) {
  console.log('worker received props', props);

  return <>
    <CameraControls />
    <ambientLight intensity={1} />
    <mesh>
      <boxGeometry />
      <meshBasicMaterial color="white" />
      <Edges />
    </mesh>
  </>;
}

/**
 * @typedef Props
 * @property {string} testProp
 */