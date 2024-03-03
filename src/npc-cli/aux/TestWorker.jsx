import React from "react";
import useMeasure from "react-use-measure";
import { css, cx } from "@emotion/css";

// import { Canvas } from "@react-three/fiber";
// import Scene from "./R3FWorkerDemoScene";
import { Canvas } from '@react-three/offscreen';
const Scene = React.lazy(() => import('./TestWorkerScene'));

const worker = new Worker(new URL('./worker.jsx', import.meta.url), { type: 'module' })

// /** @param {MessageEvent} e  */
// worker.addEventListener('message', e => {
//   console.log('main thread received message from worker', e.data);
// });

/**
 * @param {Props} props 
 */
export default function TestWorker(props) {

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
      className={cx(testWorkerCss, { disabled: props.disabled })}
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

const testWorkerCss = css`
  height: 100%;
  opacity: 1;
  transition: opacity 500ms;
  &.disabled {
    opacity: 0;
  }
`;
