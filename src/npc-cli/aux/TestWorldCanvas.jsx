import React from "react";
import { css } from "@emotion/css";
import { Canvas } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Stats } from "@react-three/drei";

import { isTouchDevice } from "../service/dom.js";
import "./infinite-grid-helper.js";
import { Vect } from "../geom";
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
    rootEl: /** @type {*} */ (null),
    rootState: /** @type {*} */ (null),

    canvasRef(canvasEl) {
      if (canvasEl && !state.canvasEl) {
        state.canvasEl = canvasEl;
        state.rootEl = /** @type {*} */ (canvasEl.parentElement?.parentElement);
      }
    },
    onCreated(rootState) {
      state.rootState = rootState;
      api.threeReady = true;
      api.r3f = rootState;
      api.update(); // e.g. show stats
    },
    onPointerDown(e) {
      state.down = {
        clientPos: new Vect(e.clientX, e.clientY),
        distance: 0, // or getDistance(state.input.touches)
        epochMs: Date.now(),
      };
      api.events.next({
        key: "pointerdown",
      });
    },
    onPointerUp(e) {
      if (!state.down) {
        return;
      }
      // info("infiniteGridHelper onPointerUp", e, e.point);
      const distance = state.down.clientPos.distanceTo({ x: e.clientX, y: e.clientY });
      const timeMs = Date.now() - state.down.epochMs;
      api.events.next({
        key: "pointerup",
        distance,
        longPress: timeMs >= 300,
        point: e.point,
        rmb: e.button === 2,
        // 🤔 or clientX,Y minus canvas bounds?
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        meta: {
          floor: true,
          targetCenter: undefined,
        },
      });
      state.down = undefined;
    },
    onPointerMissed(e) {
      // console.log("onPointerMissed", e.clientX, e.clientY, e);
      state.down &&
        api.events.next({
          key: "pointerup-outside",
          distance: state.down.clientPos.distanceTo({ x: e.clientX, y: e.clientY }),
          longPress: Date.now() - state.down.epochMs >= 300,
          rmb: e.button === 2,
          screenPoint: { x: e.offsetX, y: e.offsetY },
        });
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
      onCreated={state.onCreated}
    >
      {props.stats && state.rootEl && (
        <Stats showPanel={0} className={statsCss} parent={{ current: state.rootEl }} />
      )}
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

      <infiniteGridHelper
        args={[1.5, 1.5, "#bbbbbb"]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerUp={state.onPointerUp}
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
 * @property {import('three-stdlib').MapControls} controls
 * @property {{ clientPos: Geom.Vect; distance: number; epochMs: number; }} [down]
 * @property {HTMLDivElement} rootEl
 * @property {import('@react-three/fiber').RootState} rootState
 * @property {(canvasEl: null | HTMLCanvasElement) => void} canvasRef
 * @property {import('@react-three/fiber').CanvasProps['onCreated']} onCreated
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerDown
 * @property {(e: MouseEvent) => void} onPointerMissed
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
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
