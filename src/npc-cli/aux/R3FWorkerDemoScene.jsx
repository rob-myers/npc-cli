import React from "react";
import { CameraControls, Edges, PerspectiveCamera } from "@react-three/drei";

export default function R3FWorkerDemoScene() {
  return <>
    <CameraControls makeDefault />
    <ambientLight intensity={1} />
    <PerspectiveCamera position={[0, 8, 0]} makeDefault />
    <mesh>
      <boxGeometry />
      <meshBasicMaterial color="white" />
      <Edges />
    </mesh>
  </>;
}
