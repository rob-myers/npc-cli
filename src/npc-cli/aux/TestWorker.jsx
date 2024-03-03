import React from "react";
import useMeasure from "react-use-measure";
import { css, cx } from "@emotion/css";

// import { Canvas } from "@react-three/fiber";
// import Scene from "./R3FWorkerDemoScene";
import { Canvas } from '@react-three/offscreen';
import useStateRef from "../hooks/use-state-ref";
import debounce from "debounce";
import useUpdate from "../hooks/use-update";
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

  const state = useStateRef(() => ({
    resizing: false,
    finishedResizing: debounce(() => {
      state.resizing = false;
      update();
    }, 300),
  }));

  const [measureRef, rect] = useMeasure();

  React.useMemo(() => {
    worker.postMessage({
      type: 'resize',
      payload: {
        width: rect.width,
        height: rect.height,
        top: 0,
        left: 0,
      },
    });
    state.resizing = true;
    state.finishedResizing();
  }, [rect.width, rect.height]);

  const update = useUpdate();

  return (
    <div
      ref={measureRef}
      className={cx(testWorkerCss, { hidden: props.disabled || state.resizing })}
    >
      <Canvas
        frameloop={props.disabled ? 'never' : 'demand'}
        resize={{ debounce: 300, scroll: false }}
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
  &.hidden {
    opacity: 0;
    transition: opacity 0ms;
  }
`;
