import React from "react";
import { CameraControls, Edges } from "@react-three/drei";

export default function R3FWorkerDemoScene() {
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
