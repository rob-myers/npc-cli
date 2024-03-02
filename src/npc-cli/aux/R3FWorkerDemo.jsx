import React from "react";

// import { Canvas } from "@react-three/fiber";
// import Scene from "./R3FWorkerDemoScene";
import { Canvas } from '@react-three/offscreen';
const Scene = React.lazy(() => import('./R3FWorkerDemoScene'));

const worker = new Worker(new URL('./worker.jsx', import.meta.url), { type: 'module' })

/**
 * @param {Props} props 
 */
export default function R3FWorkerDemo(props) {
  return (
    <Canvas
      fallback={<Scene />}
      worker={worker}
    />
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */
