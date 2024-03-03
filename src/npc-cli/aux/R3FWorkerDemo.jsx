import React, { useEffect } from "react";
import useMeasure from "react-use-measure";

// import { Canvas } from "@react-three/fiber";
// import Scene from "./R3FWorkerDemoScene";
import { Canvas } from '@react-three/offscreen';
const Scene = React.lazy(() => import('./R3FWorkerDemoScene'));

const worker = new Worker(new URL('./worker.jsx', import.meta.url), { type: 'module' })

// /** @param {MessageEvent} e  */
// worker.addEventListener('message', e => {
//   console.log('main thread received message from worker', e.data);
// });

/**
 * @param {Props} props 
 */
export default function R3FWorkerDemo(props) {

  const [measureRef, rect] = useMeasure();

  React.useEffect(() => {
    worker.postMessage({
      type: 'resize',
      payload: {
        width: rect.width,
        height: rect.height,
        top: 0,
        left: 0,
      },
    });
  }, [rect.width, rect.height]);

  return (
    <div
      ref={measureRef}
      style={{ height: '100%', visibility: props.disabled ? 'hidden' : 'visible' }}
    >
      <Canvas
        frameloop={props.disabled ? 'never' : 'demand'}
        fallback={<Scene />}
        worker={worker}
      />
    </div>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */
