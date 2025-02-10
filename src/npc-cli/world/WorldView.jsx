import React from "react";
import * as THREE from "three";
import { css } from "@emotion/css";
import { Canvas } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Stats } from "@react-three/drei";
import { damp } from "maath/easing";

import { debug } from "../service/generic.js";
import { Rect, Vect } from "../geom/index.js";
import { dataUrlToBlobUrl, getModifierKeys, getRelativePointer, isRMB, isTouchDevice } from "../service/dom.js";
import { fromXrayInstancedMeshName, longPressMs, pickedTypesInSomeRoom } from "../service/const.js";
import { dampXZ, emptySceneForPicking, hasObjectPickShaderMaterial, pickingRenderTarget, toV3, toXZ, unitXVector3, v3Precision } from "../service/three.js";
import { popUpRootDataAttribute } from "../components/PopUp.jsx";
import { WorldContext } from "./world-context.js";
import useStateRef from "../hooks/use-state-ref.js";
import NpcSpeechBubbles from "./NpcSpeechBubbles.jsx";
import { ContextMenu } from "./ContextMenu.jsx";

/**
 * @param {Props} props
 */
export default function WorldView(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    canvas: /** @type {*} */ (null),
    clickIds: [],
    controls: /** @type {*} */ (null),
    controlsViewportOpts: {
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: +Infinity,
      minPolarAngle: Math.PI * 0,
      maxPolarAngle: Math.PI/4,
      minDistance: 16,
      maxDistance: 96,
      panSpeed: 2,
      zoomSpeed: 0.5,
    },
    down: null,
    epoch: { pickStart: 0, pickEnd: 0, pointerDown: 0, pointerUp: 0 },
    fov: 10,
    glOpts: {
      toneMapping: 3,
      toneMappingExposure: 1,
      logarithmicDepthBuffer: true,
      pixelRatio: window.devicePixelRatio,
    },
    justLongDown: false,
    lastDown: undefined,
    lastScreenPoint: new Vect(),
    normal: {
      tri: new THREE.Triangle(),
      indices: new THREE.Vector3(),
      mat3: new THREE.Matrix3(),
    },
    raycaster: new THREE.Raycaster(),
    rootEl: /** @type {*} */ (null),
    target: null,
    targetFov: null,
    zoomState: 'near', // 🚧 finer-grained

    canvasRef(canvasEl) {
      if (canvasEl !== null) {
        state.canvas = canvasEl;
        state.rootEl = /** @type {HTMLDivElement} */ (canvasEl.parentElement?.parentElement);
      }
    },
    clearTarget() {
      state.target?.reject?.('cancelled target');

      state.target = null;
      state.syncRenderMode();

      // @ts-ignore see patch
      state.controls.zoomToConstant = null;

      /**
       * 🔔 clear damping https://github.com/pmndrs/maath/blob/626d198fbae28ba82f2f1b184db7fcafd4d23846/packages/maath/src/easing.ts#L93
       * @type {{ __damp?: { [velKey: string]: number } }}
       */ (state.controls.target).__damp = undefined;
    },
    computeNormal(mesh, intersection) {// 🚧
      const { indices, mat3, tri } = state.normal;
      const output = new THREE.Vector3();
      indices.fromArray(
        /** @type {THREE.BufferAttribute} */ (mesh.geometry.index).array,
        /** @type {number} */ (intersection.faceIndex) * 3,
      );
      tri.setFromAttributeAndIndices(mesh.geometry.attributes.position, indices.x, indices.y, indices.z);
      tri.getNormal(output);
      const normalMatrix = mat3.getNormalMatrix(mesh.matrixWorld);
      output.applyNormalMatrix(normalMatrix);
      return output;
    },
    getDownDistancePx() {
      return state.down?.screenPoint.distanceTo(state.lastScreenPoint) ?? 0;
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
      return {
        key,
        position: new THREE.Vector3().copy(position),
        point: toXZ(position),
        distancePx,
        justLongDown,
        keys: getModifierKeys(event.nativeEvent),
        pointers: state.getNumPointers(),
        rmb: isRMB(event.nativeEvent),
        screenPoint: getRelativePointer(event),
        touch: isTouchDevice(),
        meta,
        ...key === 'pointerup' && { clickId: state.clickIds.pop() },
      };
    },
    follow(dst, opts = { smoothTime: 1 }) {
      // @ts-ignore see patch
      state.controls.zoomToConstant = null;

      state.target = {
        dst,
        y: 1.5, // agent height
        ...opts,
      };
    },
    handleClickInDebugMode(e) {
      if (
        w.disabled === true
        && w.menu.debugMode === true
        && state.lastDown !== undefined
        && state.lastDown.longDown === false
        && state.lastDown.screenPoint.distanceTo(getRelativePointer(e)) < 1
      ) {
        w.npc.tickOnceDebug();
      }
    },
    // linear via `{ maxSpeed: 1000 / 60 }`
    async lookAt(point, opts = { smoothTime: 0.2 }) {
      if (w.disabled === true && state.target !== null && w.reqAnimId === 0) {
        state.clearTarget(); // we paused while targeting, so clear damping
      }

      return new Promise((resolve, reject) => {
        state.target = {
          dst: toV3(point),
          y: 1.5, // agent height
          resolve,
          reject,
          ...opts,
        };
        // @ts-ignore see patch
        state.controls.zoomToConstant = state.target.dst.clone();
  
        if (w.disabled === true) {// can lookAt while paused
          state.syncRenderMode();
          w.timer.reset();
          w.onDebugTick();
        }
      });

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
    onObjectPickPixel(e, pixel) {// 🔔 references `w.e`
      
      state.lastDown = undefined; // overwritten below on successful raycast
      
      const [r, g, b, a] = Array.from(pixel);
      const decoded = w.e.decodeObjectPick(r, g, b, a);
      debug('picked:', { r, g, b, a }, '\n', decoded);

      if (decoded === null) {
        return;
      }

      const res = w.e.getRaycastIntersection(e, decoded);

      if (res === null) {
        return;
      }

      const position = v3Precision(decoded.picked === 'npc'
        ? w.n[decoded.npcKey].position.clone()
        : res.intersection.point.clone()
      );
      
      const normal = decoded.picked === 'npc'
        ? new THREE.Vector3(0, 1, 0)
        : state.computeNormal(res.mesh, res.intersection)
      ;
      // 🔔 fix flipped normals e.g. double-sided decor quad
      w.r3f.camera.getWorldDirection(tmpVectThree);
      if (normal.dot(tmpVectThree) > 0) {
        normal.multiplyScalar(-1);
      }

      const meta = {
        ...decoded,
        ...pickedTypesInSomeRoom[decoded.picked] === true
          && w.gmGraph.findRoomContaining(toXZ(position), true),
      };

      state.lastDown = {
        longDown: false,
        screenPoint: Vect.from(getRelativePointer(e)),
        position: position.clone(),
        normal,
        quaternion: new THREE.Quaternion().setFromUnitVectors(unitXVector3, normal),
        meta,
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
        // Native "pointerup" occurred before we finished this object-pick.
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
      const sp = getRelativePointer(e);
      state.lastScreenPoint.copy(sp);
      state.epoch.pointerDown = Date.now();

      window.clearTimeout(state.down?.longTimeoutId); // No MultiTouch Long Press

      if (e.target !== state.canvas) {
        return; // ignore ContextMenu clicks
      }

      const cameraKey = e.metaKey || e.ctrlKey || e.shiftKey;

      state.down = {
        screenPoint: state.lastScreenPoint.clone(),
        longTimeoutId: state.down || cameraKey ? 0 : window.setTimeout(() => {
          state.justLongDown = true;
          if (state.lastDown === undefined) {
            return;
          }
          state.lastDown.longDown = true;
          w.events.next(state.getWorldPointerEvent({
            key: "long-pointerdown",
            event: e,
            justLongDown: false,
            meta: {},
            position: state.lastDown.position,
          }));
        }, longPressMs),
        pointerIds: (state.down?.pointerIds ?? []).concat(e.pointerId),
      };

      // includes async render-and-read-pixel
      state.pickObject(e);
    },
    onPointerLeave(e) {
      if (!state.down) {
        return;
      }

      window.clearTimeout(state.down.longTimeoutId);

      state.down.pointerIds = state.down.pointerIds.filter(x => x !== e.pointerId);
      if (state.down.pointerIds.length === 0) {
        state.down = null;
      }

      const rect = Rect.fromJson(state.canvas.getBoundingClientRect());
      if (!rect.contains({ x: e.clientX, y: e.clientY })) {
        state.justLongDown = false; // on drag outside
      }
    },
    onPointerMove(e) {
      state.lastScreenPoint.copy(getRelativePointer(e));

      if (state.target?.resolve !== undefined && state.down !== null && state.getDownDistancePx() > 5) {
        state.clearTarget(); // cancel target if moved a bit
      }
    },
    onPointerUp(e) {
      state.epoch.pointerUp = Date.now();
      if (state.down === null || state.lastDown === undefined) {
        return;
      }

      if (state.epoch.pickStart < state.epoch.pickEnd) {
        // object-pick has finished, so can send world event
        w.events.next(state.getWorldPointerEvent({
          key: "pointerup",
          event: e,
          meta: state.lastDown.meta ?? {},
          position: state.lastDown.position,
        }));
      }

      state.onPointerLeave(e);
      state.justLongDown = false;

      state.handleClickInDebugMode(e); // step world in debug mode
    },
    onTick(deltaMs) {
      if (state.targetFov !== null) {
        w.r3f.camera.fov = state.fov;
        w.r3f.camera.updateProjectionMatrix();
        if (damp(state, 'fov', state.targetFov, 0.1, deltaMs, undefined, undefined, undefined) === false) {
          state.targetFov = null;
          state.syncRenderMode();
        }
      }

      if (state.target !== null) {
        if (dampXZ(state.controls.target, state.target.dst, state.target.smoothTime, deltaMs, state.target.maxSpeed, state.target.y, 0.01) === false) {
          if (state.target.resolve !== undefined) {
            state.target.resolve();
            state.clearTarget();
          }
        }
        //@ts-ignore see patch i.e. fix azimuth angle
        state.controls.update(true);
      }
    },
    openSnapshot(type = 'image/webp', quality) {
      window.open(dataUrlToBlobUrl(state.toDataURL(type, quality)), '_blank');
    },
    pickObject(e) {// https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js
      const { gl, camera } = w.r3f;
      // handle fractional device pixel ratio e.g. 2.625 on Pixel
      const glPixelRatio = gl.getPixelRatio();
      const targetRect = (/** @type {HTMLElement} */ (e.target)).getBoundingClientRect();

      // Set the projection matrix to only look at the pixel we are interested in.
      camera.setViewOffset(
        state.canvas.width,
        state.canvas.height,
        (e.clientX - targetRect.left) * glPixelRatio,
        (e.clientY - targetRect.top) * glPixelRatio,
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
    renderObjectPickScene() {// 🚧 more efficient approach to render list
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
      renderList.transparent.forEach(x => {
        // 🔔 ignore walls, ceilings, doors
        if (w.wall.opacity < 1 && x.object.name in fromXrayInstancedMeshName) {
          return;
        }
        if (hasObjectPickShaderMaterial(x)) {
          state.renderObjectPickItem(gl, scene, camera, x);
        }
      });
    },
    syncRenderMode() {
      const frameloop = w.disabled === true && state.target === null && state.targetFov === null ? 'demand' : 'always';
      w.r3f?.set({ frameloop });
      return frameloop;
    },
    toDataURL(type, quality) {
      w.r3f.advance(Date.now());
      return state.canvas.toDataURL(type, quality);
    },
  }), { reset: { controlsViewportOpts: true } });

  w.view = state;

  React.useEffect(() => {
    if (state.controls && !w.crowd) {// 🔔 initially only
      state.controls.setPolarAngle(w.smallViewport ? Math.PI / 2 : Math.PI / 4);
      state.controls.setAzimuthalAngle(w.smallViewport ? Math.PI / 6 : Math.PI / 4);
    }
    emptySceneForPicking.onAfterRender = state.renderObjectPickScene;
  }, [state.controls]);

  return (
    <Canvas
      ref={state.canvasRef}
      className={rootCss}
      frameloop={state.syncRenderMode()}
      resize={{ debounce: 0 }}
      gl={state.glOpts}
      onCreated={state.onCreated}
      onPointerDown={w.r3f ? state.onPointerDown : undefined}
      onPointerMove={state.onPointerMove}
      onPointerUp={state.onPointerUp}
      onPointerLeave={state.onPointerLeave}
      onContextMenu={e => isTouchDevice() && e.preventDefault()}
      tabIndex={0}
      {...{ [popUpRootDataAttribute]: true }}
    >
      {props.children}

      {props.stats && state.rootEl &&
        <Stats showPanel={0} className={statsCss} parent={{ current: state.rootEl }} />
      }

      <PerspectiveCamera
        position={[0, 32, 0]}
        makeDefault
        fov={state.fov}
        zoom={1}
      />

      <MapControls
        ref={state.ref('controls')}
        makeDefault
        zoomToCursor
        onChange={state.onChangeControls}
        domElement={state.canvas}
        {...state.controlsViewportOpts}
        //@ts-ignore see three-stdlib patch
        minPanDistance={w.smallViewport ? 0.05 : 0}
      />

      <ContextMenu/>

      <NpcSpeechBubbles/>
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
 * @property {() => void} clearTarget
 * @property {(mesh: THREE.Mesh, intersection: THREE.Intersection) => THREE.Vector3} computeNormal
 * @property {import('three-stdlib').MapControls} controls
 * @property {import('@react-three/drei').MapControlsProps} controlsViewportOpts
 * @property {{ screenPoint: Geom.Vect; pointerIds: number[]; longTimeoutId: number; } | null} down
 * Defined iff at least one pointer is down.
 * @property {{ pickStart: number; pickEnd: number; pointerDown: number; pointerUp: number; }} epoch
 * Each uses Date.now() i.e. milliseconds since epoch
 * @property {number} fov
 * @property {import('@react-three/fiber').RenderProps<HTMLCanvasElement>['gl']} glOpts
 * @property {NPC.DownData} [lastDown]
 * Defined iff last pointer was down over the World.
 * @property {boolean} justLongDown
 * @property {Geom.Vect} lastScreenPoint Updated `onPointerMove` and `onPointerDown`.
 * @property {{ tri: THREE.Triangle; indices: THREE.Vector3; mat3: THREE.Matrix3 }} normal
 * @property {THREE.Raycaster} raycaster
 * @property {HTMLDivElement} rootEl
 * @property {null | { dst: THREE.Vector3; y?: number; reject?(err?: any): void; resolve?(): void; } & LookAtOpts} target
 * Speed is m/s
 * @property {null | number} targetFov
 * @property {'near' | 'far'} zoomState
 *
 * @property {() => number} getDownDistancePx
 * @property {() => number} getNumPointers
 * @property {(e: React.PointerEvent, pixel: THREE.TypedArray) => void} onObjectPickPixel
 * @property {(def: WorldPointerEventDef) => NPC.PointerUpEvent | NPC.PointerDownEvent | NPC.LongPointerDownEvent} getWorldPointerEvent
 * @property {(dst: THREE.Vector3, opts?: LookAtOpts) => void} follow
 * @property {(e: React.PointerEvent) => void} handleClickInDebugMode
 * @property {(input: Geom.VectJson | THREE.Vector3Like, opts?: LookAtOpts) => Promise<void>} lookAt
 * @property {() => import("@react-three/fiber").RootState['frameloop']} syncRenderMode
 * @property {import('@react-three/drei').MapControlsProps['onChange']} onChangeControls
 * @property {import('@react-three/fiber').CanvasProps['onCreated']} onCreated
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerDown
 * @property {(e: React.PointerEvent) => void} onPointerLeave
 * @property {(e: React.PointerEvent) => void} onPointerMove
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerUp
 * @property {(deltaMs: number) => void} onTick
 * @property {(type?: string, quality?: any) => void} openSnapshot
 * @property {(e: React.PointerEvent<HTMLElement>) => void} pickObject
 * @property {(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, ri: THREE.RenderItem & { material: THREE.ShaderMaterial }) => void} renderObjectPickItem
 * @property {() => void} renderObjectPickScene
 * @property {HTMLCanvasElement['toDataURL']} toDataURL
 * Canvas only e.g. no ContextMenu
 */

const rootCss = css`
  user-select: none;

  > div:first-child {
    display: flex;
    align-items: center;
    justify-content: center;

    canvas {
      background-color: rgba(20, 20, 20, 1);
      width: 100%;
      height: 100%;
      /* background-color: rgba(60, 60, 60, 1); */
      /* background-color: rgba(255, 255, 255, 1); */
    }
  }

`;

const statsCss = css`
  position: absolute !important;
  z-index: 0 !important;
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
 * @property {THREE.Vector3Like} position
*/

/**
 * @typedef LookAtOpts
 * @property {number} [maxSpeed]
 * @property {number} [smoothTime]
*/

const pixelBuffer = new Uint8Array(4);
const tmpVectThree = new THREE.Vector3();
