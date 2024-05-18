import React from "react";
import { css } from "@emotion/css";
import { Canvas } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Stats } from "@react-three/drei";

import { Vect } from "../geom";
import { isRMB, isTouchDevice } from "../service/dom.js";
import { longPressMs } from "../service/const.js";
import { InfiniteGrid } from "../service/three";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import { Origin } from "./MiscThree";

/**
 * @param {Props} props
 */
export default function TestWorldCanvas(props) {
  const state = useStateRef(/** @returns {State} */ () => ({
    canvasEl: /** @type {*} */ (null),
    controls: /** @type {*} */ (null),
    down: undefined,
    justLongDown: false,
    pointerOffset: new Vect(),
    rootEl: /** @type {*} */ (null),
    rootState: /** @type {*} */ (null),

    canvasRef(canvasEl) {
      if (canvasEl && !state.canvasEl) {
        state.canvasEl = canvasEl;
        state.rootEl = /** @type {*} */ (canvasEl.parentElement?.parentElement);
      }
    },
    getDownDistancePx(e) {
      return state.down?.offset.distanceTo({ x: e.offsetX, y: e.offsetY }) ?? 0;
    },
    onCreated(rootState) {
      state.rootState = rootState;
      api.threeReady = true;
      api.r3f = rootState;
      api.update(); // e.g. show stats
    },
    onGridPointerDown(e) {
      // state.downPoint = e.point.clone();
      api.events.next({
        key: "pointerdown",
        is3d: true,
        distancePx: 0,
        justLongDown: false,
        rmb: isRMB(e.nativeEvent),
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        point: e.point,
        meta: {
          floor: true,
        },
      });
    },
    onGridPointerUp(e) {
      if (!state.down) {
        return;
      }

      window.clearTimeout(state.down.longTimeoutId);
      // const timeMs = Date.now() - state.down.epochMs;

      api.events.next({
        key: "pointerup",
        is3d: true,
        distancePx: state.getDownDistancePx(e.nativeEvent),
        justLongDown: state.justLongDown,
        rmb: isRMB(e.nativeEvent),
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        point: e.point,
        meta: {
          floor: true,
        },
      });

      state.down = undefined;
      state.justLongDown = false;
    },
    onPointerDown(e) {
      const screenPoint = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      state.pointerOffset.set(screenPoint.x, screenPoint.y);

      state.down = {
        offset: state.pointerOffset.clone(),
        distance: 0,
        epochMs: Date.now(),
        longTimeoutId: window.setTimeout(() => {
          state.justLongDown = true;
          api.events.next({
            key: "long-pointerdown",
            distancePx: state.getDownDistancePx(e.nativeEvent),
            screenPoint,
          });
        }, longPressMs),
      };

      api.events.next({
        key: "pointerdown",
        is3d: false,
        distancePx: 0,
        justLongDown: false,
        rmb: isRMB(e.nativeEvent),
        screenPoint,
      });
    },
    onPointerMove(e) {
      state.pointerOffset.set(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    },
    onPointerMissed(e) {
      if (!state.down) {
        return;
      }

      api.events.next({
        key: "pointerup-outside",
        is3d: false,
        distancePx: state.getDownDistancePx(e),
        justLongDown: state.justLongDown,
        rmb: isRMB(e),
        screenPoint: { x: e.offsetX, y: e.offsetY },
      });
      state.justLongDown = false;
      state.down = undefined;
    },
  }));

  const api = React.useContext(TestWorldContext);
  api.view = state;

  React.useEffect(() => {
    // 🚧 do not trigger on HMR
    state.controls?.setPolarAngle(Math.PI / 4); // Initialize view
  }, [state.controls]);

  return (
    <Canvas
      ref={state.canvasRef}
      className={canvasCss}
      // "never" broke TestCharacter sporadically
      frameloop={props.disabled ? "demand" : "always"}
      resize={{ debounce: 300 }}
      gl={{ toneMapping: 4, toneMappingExposure: 1, logarithmicDepthBuffer: true }}
      onPointerDown={state.onPointerDown}
      onPointerMissed={state.onPointerMissed}
      onPointerMove={state.onPointerMove}
      onCreated={state.onCreated}
    >
      {props.stats && state.rootEl &&
        <Stats showPanel={0} className={statsCss} parent={{ current: state.rootEl }} />
      }

      <PerspectiveCamera position={[0, 8, 0]} makeDefault />

      <MapControls
        ref={(x) => x && (state.controls = x)}
        makeDefault
        zoomToCursor
        {...(isTouchDevice() && {
          minAzimuthAngle: 0,
          maxAzimuthAngle: 0,
        })}
      />

      <ambientLight intensity={1} />

      <Origin />

      <InfiniteGrid
        size1={1.5}
        size2={1.5}
        color="#bbbbbb"
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={state.onGridPointerDown}
        onPointerUp={state.onGridPointerUp}
      />

      {props.children}
    </Canvas>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {React.ReactNode} [children]
 * @property {boolean} [stats]
 */

/**
 * @typedef State
 * @property {HTMLCanvasElement} canvasEl
 * @property {(canvasEl: null | HTMLCanvasElement) => void} canvasRef
 * @property {(e: PointerEvent | MouseEvent) => number} getDownDistancePx
 * @property {import('three-stdlib').MapControls} controls
 * @property {{ offset: Geom.Vect; distance: number; epochMs: number; longTimeoutId: number; } | undefined} down
 * @property {boolean} justLongDown
 * @property {Geom.Vect} pointerOffset
 * @property {HTMLDivElement} rootEl
 * @property {import('@react-three/fiber').RootState} rootState
 * @property {import('@react-three/fiber').CanvasProps['onCreated']} onCreated
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerDown
 * @property {(e: MouseEvent) => void} onPointerMissed
 * @property {(e: React.PointerEvent) => void} onPointerMove
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onGridPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onGridPointerUp
 */

const canvasCss = css`
  user-select: none;

  > div {
    background-color: black;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  canvas {
    background-color: rgba(255, 255, 255, 1);
    width: 100%;
    height: 100%;
  }
`;

const statsCss = css`
  position: absolute !important;
  z-index: 4 !important;
  left: unset !important;
  right: 0px;
`;
