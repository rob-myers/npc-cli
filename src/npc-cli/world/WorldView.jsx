import React from "react";
import * as THREE from "three";
import { css } from "@emotion/css";
import { Canvas } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Stats } from "@react-three/drei";
import { damp } from "maath/easing";

import { testNever } from "../service/generic.js";
import { Rect, Vect } from "../geom/index.js";
import { getModifierKeys, isRMB, isSmallViewport, isTouchDevice } from "../service/dom.js";
import { longPressMs, pickedTypesInSomeRoom } from "../service/const.js";
import { emptySceneForPicking, getTempInstanceMesh, hasObjectPickShaderMaterial, pickingRenderTarget, toXZ, v3Precision } from "../service/three.js";
import { WorldContext } from "./world-context.js";
import useStateRef from "../hooks/use-state-ref.js";
import useOnResize from "../hooks/use-on-resize.js";

/**
 * @param {Props} props
 */
export default function WorldCanvas(props) {
  const smallViewport = isSmallViewport();

  const state = useStateRef(/** @returns {State} */ () => ({
    canvas: /** @type {*} */ (null),
    clickIds: [],
    controls: /** @type {*} */ (null),
    down: undefined,
    epoch: { pickStart: 0, pickEnd: 0, pointerDown: 0, pointerUp: 0 },
    fov: smallViewport ? 20 : 10,
    justLongDown: false,
    lastDown: undefined,
    lastScreenPoint: new Vect(),
    raycaster: new THREE.Raycaster(),
    rootEl: /** @type {*} */ (null),
    targetFov: /** @type {null | number} */ (null),
    zoomState: 'near',

    canvasRef(canvasEl) {
      if (canvasEl !== null) {
        state.canvas = canvasEl;
        state.rootEl = /** @type {*} */ (canvasEl.parentElement?.parentElement);
      }
    },
    getDownDistancePx() {
      return state.down?.screenPoint.distanceTo(state.lastScreenPoint) ?? 0;
    },
    getLastDownMeta() {
      return state.lastDown?.threeD?.meta ?? null;
    },
    getNumPointers() {
      return state.down?.pointerIds.length ?? 0;
    },
    getWorldPointerEvent({
      key,
      distancePx = state.getDownDistancePx(),
      event,
      justLongDown = state.justLongDown,
      meta,
      position,
    }) {
      if (key === 'pointerup' || key === 'pointerdown') {
        return {
          key,
          // is3d means we have a specific 3d point
          ...position
            ? { is3d: true, position, point: { x: position.x, y: position.z } }
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
          is3d: false, // 🚧 could be true?
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
      throw Error(`${'getWorldPointerEvent'}: key "${key}" should be in ${
        JSON.stringify(['pointerup', 'pointerdown', 'long-pointerdown', 'pointerup-outside'])
      }`);
    },
    onChangeControls(e) {
      const zoomState = state.controls.getDistance() > 20 ? 'far' : 'near';
      zoomState !== state.zoomState && w.events.next({ key: 'changed-zoom', level: zoomState });
      state.zoomState = zoomState;
    },
    onCreated(rootState) {
      w.threeReady = true;
      w.r3f = /** @type {typeof w['r3f']} */ (rootState);
      w.update(); // e.g. show stats
    },
    onObjectPickPixel(e, pixel) {
      const [r, g, b, a] = Array.from(pixel);
      const decoded = w.e.decodeObjectPick(r, g, b, a);
      console.log('🔔', { r, g, b, a }, '\n', decoded);

      if (decoded === null) {
        return;
      }

      /** @type {undefined | THREE.Intersection} */
      let intersection = undefined;
      /** @type {THREE.Mesh} */
      let mesh;

      // handle fractional device pixel ratio e.g. 2.625 on Pixel
      const devicePixelRatio = Math.floor(window.devicePixelRatio);
      const normalizedDeviceCoords = new THREE.Vector2(
        -1 + 2 * ((e.nativeEvent.offsetX * devicePixelRatio) / state.canvas.width),
        +1 - 2 * ((e.nativeEvent.offsetY * devicePixelRatio) / state.canvas.height),
      );
      state.raycaster.setFromCamera(normalizedDeviceCoords, w.r3f.camera);

      switch (decoded.picked) {
        case 'floor': mesh = getTempInstanceMesh(w.floor.inst, decoded.instanceId); break;
        case 'wall': mesh = getTempInstanceMesh(w.wall.inst, decoded.instanceId); break;
        case 'npc': mesh = w.n[decoded.npcKey].m.mesh; break;
        case 'door': mesh = getTempInstanceMesh(w.door.inst, decoded.instanceId); break;
        case 'quad': mesh = getTempInstanceMesh(w.decor.quadInst, decoded.instanceId); break;
        case 'obstacle': mesh = getTempInstanceMesh(w.obs.inst, decoded.instanceId); break;
        case 'ceiling': mesh = getTempInstanceMesh(w.ceil.inst, decoded.instanceId); break;
        case 'cuboid': mesh = getTempInstanceMesh(w.decor.cuboidInst, decoded.instanceId); break;
        case 'lock-light': mesh = getTempInstanceMesh(w.door.lockSigInst, decoded.instanceId); break;
        default: throw testNever(decoded.picked);
      }

      intersection = state.raycaster.intersectObject(mesh)[0];

      if (intersection === undefined) {
        return;
      }
    
      const position = v3Precision(intersection.point);  
      const meta = {
        ...decoded,
        ...pickedTypesInSomeRoom[decoded.picked] === true && w.gmGraph.findRoomContaining(toXZ(position), true),
      };

      w.events.next(state.getWorldPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        justLongDown: false,
        meta,
        position,
      }));

      if (state.epoch.pointerUp > state.epoch.pickStart) {
        // "pointerup" occurred before we finished this object-pick.
        // We can now trigger the world event:
        w.events.next(state.getWorldPointerEvent({
          key: "pointerup",
          event: e,
          meta,
          position,
        }));
      }
    },
    onPointerDown(e) {
      const sp = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      state.lastScreenPoint.copy(sp);
      state.epoch.pointerDown = Date.now();

      window.clearTimeout(state.down?.longTimeoutId); // No MultiTouch Long Press
      
      const cameraKey = e.metaKey || e.ctrlKey || e.shiftKey;

      state.down = {
        screenPoint: state.lastScreenPoint.clone(),
        longTimeoutId: state.down || cameraKey ? 0 : window.setTimeout(() => {
          state.justLongDown = true;
          w.events.next(state.getWorldPointerEvent({
            key: "long-pointerdown",
            event: e,
            justLongDown: false,
            meta: {},
          }));
        }, longPressMs),
        pointerIds: (state.down?.pointerIds ?? []).concat(e.pointerId),
      };

      if (w.r3f === null) {
        return; // ignore early clicks
      }
      
      // includes async render-and-read-pixel
      state.pickObject(e)
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
    onPointerUp(e) {
      state.epoch.pointerUp = Date.now();
      if (state.down === undefined) {
        return;
      }

      if (state.epoch.pickStart < state.epoch.pickEnd) {
        // object-pick has finished, so can send world event
        w.events.next(state.getWorldPointerEvent({
          key: "pointerup",
          event: e,
          meta: state.getLastDownMeta() ?? {},
          position: state.lastDown?.threeD?.point,
        }));
      }

      state.onPointerLeave(e);
      state.justLongDown = false;
    },
    onTick(deltaMs) {
      if (state.targetFov !== null && w.r3f !== null) {
        if (damp(state, 'fov', state.targetFov, 0.2, deltaMs, undefined, undefined, undefined) === false) {
          state.targetFov = null;
        }
        /** @type {THREE.PerspectiveCamera} */ (w.r3f.camera).fov = state.fov;
        w.r3f.camera.updateProjectionMatrix();
      }
    },
    onWheel(e) {
      if (w.menu.ctOpen === true) {
        w.menu.hide();
        w.menu.justOpen = false;
      }
    },
    pickObject(e) {// https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js
      const { gl, camera } = w.r3f;
      // handle fractional device pixel ratio e.g. 2.625 on Pixel
      const devicePixelRatio = Math.floor(window.devicePixelRatio);
      // Set the projection matrix to only look at the pixel we are interested in.
      camera.setViewOffset(
        state.canvas.width,
        state.canvas.height,
        e.nativeEvent.offsetX * devicePixelRatio,
        e.nativeEvent.offsetY * devicePixelRatio,
        1,
        1,
      );

      gl.setRenderTarget(pickingRenderTarget);
      gl.clear();
      gl.render(emptySceneForPicking, camera);

      state.epoch.pickStart = Date.now();
      e.persist();
      gl.readRenderTargetPixelsAsync(pickingRenderTarget, 0, 0, 1, 1, pixelBuffer)
        .then(state.onObjectPickPixel.bind(null, e))
        .finally(() => state.epoch.pickEnd = Date.now())
      ;

      gl.setRenderTarget(null);
      camera.clearViewOffset();
    },
    renderObjectPickItem(gl, scene, camera, x) {
      x.material.uniforms.objectPick.value = true;
      x.material.uniformsNeedUpdate = true;
      gl.renderBufferDirect(camera, scene, /** @type {THREE.BufferGeometry} */ (x.geometry), x.material, x.object, null);
      // We immediately turn objectPick off e.g. overriding manual prop in Memoed <Npc>
      x.material.uniforms.objectPick.value = false;
      x.material.uniformsNeedUpdate = true;
    },
    renderObjectPickScene() {
      const { gl, scene, camera } = w.r3f;
      // https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js
      // This is the magic, these render lists are still filled with valid data.  So we can
      // submit them again for picking and save lots of work!
      const renderList = gl.renderLists.get(scene, 0);

      renderList.opaque.forEach(x => {
        if (hasObjectPickShaderMaterial(x)) {
          state.renderObjectPickItem(gl, scene, camera, x);
        }
      });
      // renderList.transmissive.forEach(processItem);
      renderList.transparent.forEach(x => {
        if (hasObjectPickShaderMaterial(x)) {
          state.renderObjectPickItem(gl, scene, camera, x);
        }
      });
    },
    setLastDown(e) {
      if (e.is3d === true || !state.lastDown) {
        state.lastDown = {
          screenPoint: Vect.from(e.screenPoint),
          threeD: e.is3d === true ? { point: new THREE.Vector3().copy(e.position), meta: e.meta } : null,
        };
      } else {
        if (!state.lastDown.screenPoint.equals(e.screenPoint)) {
          state.lastDown.screenPoint.copy(e.screenPoint);
          state.lastDown.threeD = null; // 3d pointerdown happens before 2d pointerdown
        }
      }
    },
  }));

  const w = React.useContext(WorldContext);
  w.view = state;

  React.useEffect(() => {
    if (state.controls) {
      state.controls.setPolarAngle(Math.PI / 4);
      state.controls.setAzimuthalAngle(initAzimuth);
    }
    emptySceneForPicking.onAfterRender = state.renderObjectPickScene;
  }, [state.controls]);

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
        fov={state.fov}
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
          maxPolarAngle: Math.PI / 4,
        }}
        minDistance={smallViewport ? 10 : 5}
        maxDistance={smallViewport ? 20 : 50}
        panSpeed={2}
      />

      <ambientLight intensity={1} />

      <Origin />

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
 * @property {{ screenPoint: Geom.Vect; pointerIds: number[]; longTimeoutId: number; } | undefined} down
 * Defined iff at least one pointer is down.
 * @property {{ pickStart: number; pickEnd: number; pointerDown: number; pointerUp: number; }} epoch
 * Each uses Date.now() i.e. milliseconds since epoch
 * @property {number} fov
 * @property {{ screenPoint: Geom.Vect; threeD: null | { point: import("three").Vector3; meta: Geom.Meta }} | undefined} lastDown
 * Defined iff pointer has ever been down.
 * @property {boolean} justLongDown
 * @property {Geom.Vect} lastScreenPoint
 * This is `PointerEvent.offset{X,Y}` and is updated `onPointerMove`.
 * @property {THREE.Raycaster} raycaster
 * @property {HTMLDivElement} rootEl
 * @property {null | number} targetFov
 * @property {'near' | 'far'} zoomState
 *
 * @property {() => number} getDownDistancePx
 * @property {() => number} getNumPointers
 * @property {(e: React.PointerEvent, pixel: THREE.TypedArray) => void} onObjectPickPixel
 * @property {() => null | Geom.Meta} getLastDownMeta
 * @property {(def: WorldPointerEventDef) => NPC.PointerUpEvent | NPC.PointerDownEvent | NPC.LongPointerDownEvent} getWorldPointerEvent
 * @property {import('@react-three/drei').MapControlsProps['onChange']} onChangeControls
 * @property {import('@react-three/fiber').CanvasProps['onCreated']} onCreated
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerDown
 * @property {(e: React.PointerEvent) => void} onPointerLeave
 * @property {(e: React.PointerEvent) => void} onPointerMove
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerUp
 * @property {(deltaMs: number) => void} onTick
 * @property {(e: React.WheelEvent<HTMLElement>) => void} onWheel
 * @property {(e: React.PointerEvent<HTMLElement>) => void} pickObject
 * @property {(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, ri: THREE.RenderItem & { material: THREE.ShaderMaterial }) => void} renderObjectPickItem
 * @property {() => void} renderObjectPickScene
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
    /* background-color: rgba(60, 60, 60, 1); */
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
 * @typedef WorldPointerEventDef
 * @property {'pointerup' | 'pointerdown' | 'long-pointerdown'} key
 * @property {number} [distancePx]
 * @property {React.PointerEvent | React.MouseEvent} event
 * @property {boolean} [justLongDown]
 * @property {Geom.Meta} meta
 * @property {THREE.Vector3Like} [position]
 */

const initAzimuth = Math.PI / 6;
const fixedPolarAngle = Math.PI / 7;
const pixelBuffer = new Uint8Array(4);

function Origin() {
  return (
    <mesh scale={[0.025, 1, 0.025]} position={[0, 0.5 - 0.001, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}
