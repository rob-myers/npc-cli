import React from "react";
import * as THREE from "three";
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
    canvas: /** @type {*} */ (null),
    controls: /** @type {*} */ (null),
    down: undefined,
    justLongDown: false,
    lastDown: undefined,
    lastScreenPoint: new Vect(),
    rootEl: /** @type {*} */ (null),
    rootState: /** @type {*} */ (null),

    canvasRef(canvasEl) {
      if (canvasEl && !state.canvas) {
        state.canvas = canvasEl;
        state.rootEl = /** @type {*} */ (canvasEl.parentElement?.parentElement);
      }
    },
    getDownDistancePx() {
      return state.down?.screenPoint.distanceTo(state.lastScreenPoint) ?? 0;
    },
    getNumPointers() {
      return state.down?.pointerIds.length ?? 0;
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
        pointers: state.getNumPointers(),
        rmb: isRMB(e.nativeEvent),
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        touch: isTouchDevice(),
        point: e.point,
        meta: {
          floor: true,
        },
      });
    },
    onGridPointerUp(e) {
      api.events.next({
        key: "pointerup",
        is3d: true,
        distancePx: state.getDownDistancePx(),
        justLongDown: state.justLongDown,
        pointers: state.getNumPointers(),
        rmb: isRMB(e.nativeEvent),
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        touch: isTouchDevice(),
        point: e.point,
        meta: {
          floor: true,
        },
      });
    },
    onPointerDown(e) {
      const sp = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      state.lastScreenPoint.set(sp.x, sp.y);

      // No MultiTouch Long Press
      window.clearTimeout(state.down?.longTimeoutId);

      state.down = {
        screenPoint: state.lastScreenPoint.clone(),
        epochMs: Date.now(),
        longTimeoutId: state.down ? 0 : window.setTimeout(() => {
          state.justLongDown = true;
          api.events.next({
            key: "long-pointerdown",
            is3d: false,
            distancePx: state.getDownDistancePx(),
            justLongDown: false,
            pointers: state.getNumPointers(),
            rmb: false, // could track
            screenPoint: sp,
            touch: isTouchDevice(),
          });
        }, longPressMs),
        pointerIds: (state.down?.pointerIds ?? []).concat(e.pointerId),
      };

      api.events.next({
        key: "pointerdown",
        is3d: false,
        distancePx: 0,
        justLongDown: false,
        pointers: state.getNumPointers(),
        rmb: isRMB(e.nativeEvent),
        screenPoint: sp,
        touch: isTouchDevice(),
      });
    },
    onPointerLeave(e) {
      if (!state.down) {
        return;
      }
      state.justLongDown = false;
      window.clearTimeout(state.down.longTimeoutId);

      state.down.pointerIds = state.down.pointerIds.filter(x => x !== e.pointerId);
      if (state.down.pointerIds.length === 0) {
        state.down = undefined;
      }
    },
    onPointerMove(e) {
      state.lastScreenPoint.set(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    },
    onPointerUp(e) {// After 3D pointerup
      if (!state.down) {
        return;
      }
      
      api.events.next({
        key: "pointerup",
        is3d: false,
        distancePx: state.getDownDistancePx(),
        justLongDown: state.justLongDown,
        pointers: state.getNumPointers(),
        rmb: isRMB(e.nativeEvent),
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        touch: isTouchDevice(),
      });

      state.onPointerLeave(e);
    },
    onPointerMissed(e) {
      if (!state.down) {
        return;
      }

      api.events.next({
        key: "pointerup-outside",
        is3d: false,
        distancePx: state.getDownDistancePx(),
        justLongDown: state.justLongDown,
        pointers: state.getNumPointers(),
        rmb: isRMB(e),
        screenPoint: { x: e.offsetX, y: e.offsetY },
        touch: isTouchDevice(),
      });
    },
    onWheel(e) {
      if (api.menu.isOpen === true) {
        api.menu.hide();
        api.menu.justOpen = false;
      }
    },
    setLastDown(e) {
      if (e.is3d || !state.lastDown) {
        state.lastDown = {
          epochMs: Date.now(),
          screenPoint: Vect.from(e.screenPoint),
          threeD: e.is3d ? { point: new THREE.Vector3().copy(e.point), meta: e.meta } : null,
        };
      } else {
        state.lastDown.epochMs = Date.now();
        if (!state.lastDown.screenPoint.equals(e.screenPoint)) {
          state.lastDown.screenPoint.copy(e.screenPoint);
          state.lastDown.threeD = null; // 3d pointerdown happens before 2d pointerdown
        }
      }
    },
  }));

  const api = React.useContext(TestWorldContext);
  api.ui = state;

  React.useEffect(() => {
    // 🚧 do not trigger on HMR
    state.controls?.setPolarAngle(Math.PI / 4); // Initialize view
  }, [state.controls]);

  return (
    <Canvas
      ref={state.canvasRef}
      className={canvasCss}
      frameloop={props.disabled ? "demand" : "always"}
      resize={{ debounce: 300 }}
      gl={{ toneMapping: 4, toneMappingExposure: 1, logarithmicDepthBuffer: true }}
      onCreated={state.onCreated}
      onPointerDown={state.onPointerDown}
      onPointerMissed={state.onPointerMissed}
      onPointerMove={state.onPointerMove}
      onPointerUp={state.onPointerUp}
      onPointerLeave={state.onPointerLeave}
      onWheel={state.onWheel}
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
 * @property {HTMLCanvasElement} canvas
 * @property {(canvasEl: null | HTMLCanvasElement) => void} canvasRef
 * @property {import('three-stdlib').MapControls} controls
 * @property {(BaseDown & { pointerIds: number[]; longTimeoutId: number; }) | undefined} down
 * Defined iff at least one pointer is down.
 * @property {BaseDown & { threeD: null | { point: import("three").Vector3; meta: Geom.Meta }} | undefined} lastDown
 * Defined iff pointer has ever been down.
 * @property {boolean} justLongDown
 * @property {Geom.Vect} lastScreenPoint
 * This is `PointerEvent.offset{X,Y}` and is updated `onPointerMove`.
 * @property {HTMLDivElement} rootEl
 * @property {import('@react-three/fiber').RootState} rootState
 * @property {() => number} getDownDistancePx
 * @property {() => number} getNumPointers
 * @property {import('@react-three/fiber').CanvasProps['onCreated']} onCreated
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onGridPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onGridPointerUp
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerDown
 * @property {(e: MouseEvent) => void} onPointerMissed
 * @property {(e: React.PointerEvent) => void} onPointerLeave
 * @property {(e: React.PointerEvent) => void} onPointerMove
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerUp
 * @property {(e: React.WheelEvent<HTMLElement>) => void} onWheel
 * @property {(e: NPC.PointerDownEvent) => void} setLastDown
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

/**
 * @typedef BaseDown
 * @property {number} epochMs
 * @property {Geom.Vect} screenPoint
 */
