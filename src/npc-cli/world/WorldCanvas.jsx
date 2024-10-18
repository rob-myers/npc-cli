import React from "react";
import * as THREE from "three";
import { css } from "@emotion/css";
import { Canvas } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Stats } from "@react-three/drei";

import { Rect, Vect } from "../geom/index.js";
import { getModifierKeys, isRMB, isSmallViewport, isTouchDevice } from "../service/dom.js";
import { longPressMs } from "../service/const.js";
import { emptySceneForPicking, getQuadGeometryXZ, pickingRenderTarget } from "../service/three.js";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref.js";
import useOnResize from "../hooks/use-on-resize.js";

/**
 * @param {Props} props
 */
export default function WorldCanvas(props) {
  const state = useStateRef(/** @returns {State} */ () => ({
    canvas: /** @type {*} */ (null),
    clickIds: [],
    controls: /** @type {*} */ (null),
    down: undefined,
    justLongDown: false,
    lastDown: undefined,
    lastScreenPoint: new Vect(),
    rootEl: /** @type {*} */ (null),
    rootState: /** @type {*} */ (null),
    zoomState: 'near',

    canvasRef(canvasEl) {
      if (canvasEl && !state.canvas) {
        state.canvas = canvasEl;
        state.rootEl = /** @type {*} */ (canvasEl.parentElement?.parentElement);
      }
    },
    getDownDistancePx() {
      return state.down?.screenPoint.distanceTo(state.lastScreenPoint) ?? 0;
    },
    getNpcPointerEvent({
      key,
      distancePx = state.getDownDistancePx(),
      event,
      is3d,
      justLongDown = state.justLongDown,
      meta,
    }) {
      if (key === 'pointerup' || key === 'pointerdown') {
        return {
          key,
          ...is3d && 'point' in event // ThreeEvent<PointerEvent>
            ? { is3d: true, point: event.point }
            : { is3d: false },
          distancePx,
          justLongDown,
          keys: getModifierKeys(event.nativeEvent),
          pointers: state.getNumPointers(),
          rmb: isRMB(event.nativeEvent),
          screenPoint: { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY },
          touch: isTouchDevice(),
          meta,
          ...key === 'pointerup' && { clickId: state.clickIds.pop() },
        };
      }
      if (key === 'long-pointerdown' || key === 'pointerup-outside') {
        return {
          key,
          is3d: false,
          distancePx,
          justLongDown,
          keys: getModifierKeys(event.nativeEvent),
          pointers: state.getNumPointers(),
          rmb: isRMB(event.nativeEvent),
          screenPoint: { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY },
          touch: isTouchDevice(),
          meta,
        };
      }
      throw Error(`${'getNpcPointerEvent'}: key "${key}" should be in ${
        JSON.stringify(['pointerup', 'pointerdown', 'long-pointerdown', 'pointerup-outside'])
      }`);
    },
    getNumPointers() {
      return state.down?.pointerIds.length ?? 0;
    },
    onChangeControls(e) {
      const zoomState = state.controls.getDistance() > 20 ? 'far' : 'near';
      zoomState !== state.zoomState && w.events.next({ key: 'changed-zoom', level: zoomState });
      state.zoomState = zoomState;
    },
    onCreated(rootState) {
      state.rootState = rootState;
      w.threeReady = true;
      w.r3f = rootState;
      w.update(); // e.g. show stats
    },
    onGridPointerDown(e) {
      const { x, z: y } = e.point;
      w.events.next(state.getNpcPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        is3d: true,
        justLongDown: false,
        meta: {
          floor: true,
          ...w.gmGraph.findRoomContaining({ x, y }, true),
        },
      }));
    },
    onGridPointerUp(e) {
      const { x, z: y } = e.point;
      w.events.next(state.getNpcPointerEvent({
        key: "pointerup",
        event: e,
        is3d: true,
        meta: {
          floor: true,
          ...w.gmGraph.findRoomContaining({ x, y }, true),
        },
      }));
    },
    onPointerDown(e) {
      const sp = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      state.lastScreenPoint.set(sp.x, sp.y);
      // No MultiTouch Long Press
      window.clearTimeout(state.down?.longTimeoutId);
      
      const cameraKey = e.metaKey || e.ctrlKey || e.shiftKey;

      state.down = {
        screenPoint: state.lastScreenPoint.clone(),
        epochMs: Date.now(),
        longTimeoutId: state.down || cameraKey ? 0 : window.setTimeout(() => {
          state.justLongDown = true;
          w.events.next(state.getNpcPointerEvent({
            key: "long-pointerdown",
            event: e,
            is3d: false,
            justLongDown: false,
            meta: {},
          }));
        }, longPressMs),
        pointerIds: (state.down?.pointerIds ?? []).concat(e.pointerId),
      };

      w.events.next(state.getNpcPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        is3d: false,
        justLongDown: false,
        meta: {},
      }));
    },
    onPointerLeave(e) {
      if (!state.down) {
        return;
      }

      window.clearTimeout(state.down.longTimeoutId);

      state.down.pointerIds = state.down.pointerIds.filter(x => x !== e.pointerId);
      if (state.down.pointerIds.length === 0) {
        state.down = undefined;
      }

      const rect = Rect.fromJson(state.canvas.getBoundingClientRect());
      if (!rect.contains({ x: e.clientX, y: e.clientY })) {
        state.justLongDown = false; // on drag outside
      }
    },
    onPointerMove(e) {
      state.lastScreenPoint.set(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    },
    onPointerUp(e) {// After 3D pointerup
      if (state.down === undefined) {
        return;
      }

      state.rootState === null && state.pickObject(e) // 🚧 WIP

      w.events.next(state.getNpcPointerEvent({
        key: "pointerup",
        event: e,
        is3d: false,
        meta: {},
      }));

      state.onPointerLeave(e);
      state.justLongDown = false;
    },
    onPointerMissed(e) {
      if (!state.down) {
        return;
      }

      w.events.next(state.getNpcPointerEvent({
        key: "pointerup-outside",
        event: /** @type {React.MouseEvent} */ ({ nativeEvent: e }),
        is3d: false,
        meta: {},
      }));
    },
    onWheel(e) {
      if (w.menu.ctOpen === true) {
        w.menu.hide();
        w.menu.justOpen = false;
      }
    },
    pickObject(e) {// 🚧 WIP https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js
      const { gl, camera } = state.rootState;
      // Set the projection matrix to only look at the pixel we are interested in.
      camera.setViewOffset(
        state.canvas.width,
        state.canvas.height,
        e.nativeEvent.offsetX * window.devicePixelRatio,
        e.nativeEvent.offsetY * window.devicePixelRatio,
        1,
        1,
      );

      gl.setRenderTarget(pickingRenderTarget);
      gl.clear();
      gl.render(emptySceneForPicking, camera);
      // gl.readRenderTargetPixels(pickingRenderTarget, 0, 0, 1, 1, pixelBuffer);
      gl.readRenderTargetPixelsAsync(pickingRenderTarget, 0, 0, 1, 1, pixelBuffer).then((x) => {
        console.log('🔔', Array.from(x));
      });
      gl.setRenderTarget(null);
      camera.clearViewOffset();
    },
    renderObjectPicking() {// 🚧 WIP
      const { gl, scene, camera } = state.rootState;
      // This is the magic, these render lists are still filled with valid data.  So we can
      // submit them again for picking and save lots of work!
      const renderList = gl.renderLists.get(scene, 0);
      // renderList.opaque.forEach(processItem);
      // renderList.transmissive.forEach(processItem);
      // renderList.transparent.forEach(processItem);
      renderList.opaque.forEach(x => {
        if (x.material instanceof THREE.ShaderMaterial && x.material.uniforms.objectPicking) {
          x.material.uniforms.objectPicking.value = true;
          x.material.uniformsNeedUpdate = true;
          gl.renderBufferDirect(camera, scene, /** @type {*} */ (x.geometry), x.material, x.object, null);
        }
      });
      renderList.opaque.forEach(x => {
        if (x.material instanceof THREE.ShaderMaterial && x.material.uniforms.objectPicking) {
          x.material.uniforms.objectPicking.value = false;
          x.material.uniformsNeedUpdate = true;
        }
      });
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

  const w = React.useContext(WorldContext);
  w.ui = state;

  React.useEffect(() => {
    if (state.controls) {
      state.controls.setPolarAngle(Math.PI / 4);
      state.controls.setAzimuthalAngle(touchFixedAzimuth);
    }
    emptySceneForPicking.onAfterRender = state.renderObjectPicking;
  }, [state.controls]);

  const smallViewport = isSmallViewport();
  useOnResize();

  return (
    <Canvas
      ref={state.canvasRef}
      className={canvasCss}
      frameloop={props.disabled ? "demand" : "always"}
      resize={{ debounce: 300 }}
      gl={{
        toneMapping: 3,
        toneMappingExposure: 1,
        logarithmicDepthBuffer: true,
      }}
      onCreated={state.onCreated}
      onPointerDown={state.onPointerDown}
      onPointerMissed={state.onPointerMissed}
      onPointerMove={state.onPointerMove}
      onPointerUp={state.onPointerUp}
      onPointerLeave={state.onPointerLeave}
      onWheel={state.onWheel}
    >
      {props.children}

      {props.stats && state.rootEl &&
        <Stats showPanel={0} className={statsCss} parent={{ current: state.rootEl }} />
      }

      <PerspectiveCamera
        position={[0, 16, 0]}
        makeDefault
        fov={15}
        // fov={20}
        zoom={0.5}
      />

      <MapControls
        ref={x => state.controls = x ?? state.controls}
        key={`${smallViewport}`}
        makeDefault
        zoomToCursor
        onChange={state.onChangeControls}

        {...smallViewport ? {
          minPolarAngle: fixedPolarAngle,
          maxPolarAngle: fixedPolarAngle,
        } : {
          maxPolarAngle: Math.PI/2 * 0.5,
        }}
        minDistance={5}
        maxDistance={smallViewport ? 25 : 50}
        panSpeed={2}
      />

      <ambientLight intensity={1} />

      <Origin />

      <group
        name="floor"
        scale={[2000, 1, 2000]}
        onPointerDown={state.onGridPointerDown}
        onPointerUp={state.onGridPointerUp}
        visible={false}
      >
        <mesh args={[getQuadGeometryXZ('vanilla-xz')]} position={[-0.5, 0, -0.5]} />
      </group>
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
 * @property {string[]} clickIds
 * - Pending click identifiers, provided by shell.
 * - The last click identifier is the "current one".
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
 * @property {'near' | 'far'} zoomState
 *
 * @property {() => number} getDownDistancePx
 * @property {() => number} getNumPointers
 * @property {(def: PointerEventDef) => NPC.PointerUpEvent | NPC.PointerDownEvent | NPC.LongPointerDownEvent | NPC.PointerUpOutsideEvent} getNpcPointerEvent
 * @property {import('@react-three/drei').MapControlsProps['onChange']} onChangeControls
 * @property {import('@react-three/fiber').CanvasProps['onCreated']} onCreated
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onGridPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onGridPointerUp
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerDown
 * @property {(e: MouseEvent) => void} onPointerMissed
 * @property {(e: React.PointerEvent) => void} onPointerLeave
 * @property {(e: React.PointerEvent) => void} onPointerMove
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerUp
 * @property {(e: React.WheelEvent<HTMLElement>) => void} onWheel
 * @property {(e: React.PointerEvent<HTMLElement>) => void} pickObject
 * @property {() => void} renderObjectPicking
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
    /* background-color: rgba(255, 255, 255, 1); */
    background-color: rgba(20, 20, 20, 1);
    width: 100%;
    height: 100%;
    /* filter: sepia(1) invert(1); */
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

/**
 * @typedef PointerEventDef
 * @property {'pointerup' | 'pointerdown' | 'long-pointerdown' | 'pointerup-outside'} key
 * @property {number} [distancePx]
 * @property {import('@react-three/fiber').ThreeEvent<PointerEvent> | React.PointerEvent | React.MouseEvent} event
 * @property {boolean} is3d
 * @property {boolean} [justLongDown]
 * @property {Geom.Meta} meta
 */

const touchFixedAzimuth = Math.PI / 6;
const fixedPolarAngle = Math.PI / 5;
const pixelBuffer = new Uint8Array(4);

function Origin() {
  return (
    <mesh scale={[0.025, 1, 0.025]} position={[0, 0.5 - 0.001, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}
