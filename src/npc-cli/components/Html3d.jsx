import * as React from 'react';
import { cx } from '@emotion/css';
import * as ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber'
import useStateRef from '../hooks/use-state-ref';

/**
 * Based on https://github.com/pmndrs/drei/blob/master/src/web/Html.tsx
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const Html3d = React.forwardRef(({
  baseScale,
  children,
  className,
  docked,
  open,
  offset,
  position,
  tracked,
}, ref) => {
    const { gl, camera, scene, size, events } = useThree();

    const state = useStateRef(/** @returns {State} */ () => ({
      baseScale: 0,
      delta: [0, 0],
      domTarget: null,
      innerDiv: /** @type {*} */ (null),
      rootDiv: document.createElement('div'),
      reactRoot: /** @type {*} */ (null),
      zoom: 0,

      onFrame(_rootState) {
        if (docked === true || state.innerDiv === null) {
          return;
        }
  
        camera.updateMatrixWorld()
        const vec = state.computePosition();
        console.log(vec); // 🚧 debug mobile

        if (
          Math.abs(state.zoom - camera.zoom) > eps ||
          Math.abs(state.delta[0] - vec[0]) > eps ||
          Math.abs(state.delta[1] - vec[1]) > eps
        ) {
          state.rootDiv.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0)`;
          
          if (state.baseScale !== baseScale) {// animate set baseScale undefined
            state.innerDiv.style.transition = baseScale === undefined ? 'transform 300ms' : '';
            state.baseScale = baseScale;
          }
  
          if (baseScale === undefined) {
            state.innerDiv.style.transform = `scale(${1})`;
          } else {
            tracked === null ? v1.copy(position) : v1.setFromMatrixPosition(tracked.matrixWorld);
            const scale = objectScale(v1, camera) * baseScale;
            state.innerDiv.style.transform = `scale(${scale})`;
          }
  
          state.delta = vec;
          state.zoom = camera.zoom;
        }
      },

      computePosition() {
        if (tracked === null) {
          v1.copy(position);
        } else {
          v1.setFromMatrixPosition(tracked.matrixWorld);
        }
        if (offset !== undefined) {
          v1.add(offset);
        }
        return calculatePosition(v1, camera, size)
      }

    }), { deps: [baseScale, camera, size, docked, offset, tracked, position] });

    React.useImperativeHandle(ref, () => state, []);

    // Append to the connected element, which makes HTML work with views
    // 🔔 this is parent of parent of canvas
    state.domTarget = /** @type {HTMLElement} */ (
      (events.connected || gl.domElement.parentNode?.parentNode) ?? null
    );

    React.useLayoutEffect(() => {
      const currentRoot = (state.reactRoot = ReactDOM.createRoot(state.rootDiv));
      scene.updateMatrixWorld();
      const vec = state.computePosition();
      state.rootDiv.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0)`;
      state.domTarget?.appendChild(state.rootDiv);
      return () => {
        state.domTarget?.removeChild(state.rootDiv);
        currentRoot.unmount(); // 🔔 breaks HMR of children onchange this file
      }
    }, [state.domTarget]);

    React.useLayoutEffect(() => {
      state.reactRoot?.render(
        <div
          ref={state.ref('innerDiv')}
          children={children}
          {...docked && { transform: 'scale(1)' }}
        />
      );

      // Force update in case paused
      setTimeout(() => {
        state.zoom = 0;
        state.onFrame();
      });
    });

    /** @type {React.CSSProperties} */
    React.useLayoutEffect(() => {
      if (docked ? state.innerDiv : state.rootDiv) {
        state.rootDiv.style.visibility = open ? 'visible' : 'hidden';
        state.rootDiv.className = cx(className, { docked });
      }
    }, [state.rootDiv, state.innerDiv, open, docked, className]);

    useFrame(state.onFrame);

    return null;
  }
);

/**
 * @typedef {Omit<
 *   React.HTMLAttributes<HTMLDivElement> &
 *   BaseProps,
 * 'ref'>} Props
*/

/**
 * @typedef BaseProps
 * @property {boolean} [docked]
 * @property {number} [baseScale]
 * @property {THREE.Vector3Like} [offset]
 * @property {boolean} open
 * @property {THREE.Vector3} position
 * @property {THREE.Object3D | null} tracked
 */

/**
* @typedef State
* @property {[number, number]} delta 2D translation
* @property {null | HTMLElement} domTarget
* @property {number} [baseScale]
* @property {HTMLDivElement} innerDiv
* @property {HTMLDivElement} rootDiv
* @property {ReactDOM.Root} reactRoot
* @property {number} zoom
* @property {(rootState?: import('@react-three/fiber').RootState) => void} onFrame
* @property {() => [number, number]} computePosition
*/

const eps = 0.001;
const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()

/**
 * @param {THREE.Vector3} objectPos
 * @param {THREE.Camera} camera 
 * @param {{ width: number; height: number }} size 
 * @returns {[number, number]}
 */
function calculatePosition(objectPos, camera, size) {
  // 🤔 support tracked offset vector?
  // const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
  objectPos.project(camera);
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
}

/**
 * @param {THREE.Vector3} objectPos
 * @param {THREE.Camera} camera 
 */
export function objectScale(objectPos, camera) {
  if (camera instanceof THREE.OrthographicCamera) {
    return camera.zoom
  } else if (camera instanceof THREE.PerspectiveCamera) {
    const cameraPos = v2.setFromMatrixPosition(camera.matrixWorld)
    const vFOV = (camera.fov * Math.PI) / 180
    const dist = objectPos.distanceTo(cameraPos)
    const scaleFOV = 2 * Math.tan(vFOV / 2) * dist
    return 1 / scaleFOV
  } else {
    return 1
  }
}

/**
 * @param {number} value 
 */
function epsilon(value) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

/**
 * 
 * @param {THREE.Matrix4} matrix 
 * @param {number[]} multipliers 
 * @param {string} [prepend] 
 */
function getCSSMatrix(matrix, multipliers, prepend = '') {
  let matrix3d = 'matrix3d('
  for (let i = 0; i !== 16; i++) {
    matrix3d += epsilon(multipliers[i] * matrix.elements[i]) + (i !== 15 ? ',' : ')')
  }
  return prepend + matrix3d
}

/** @param {number[]} multipliers */
(function getCameraCSSMatrix(multipliers) {
  /** @param {THREE.Matrix4} matrix */
  return (matrix) => getCSSMatrix(matrix, multipliers)
})([1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1])

/**
 * @typedef {(
 * | 'auto'
 * | 'none'
 * | 'visiblePainted'
 * | 'visibleFill'
 * | 'visibleStroke'
 * | 'visible'
 * | 'painted'
 * | 'fill'
 * | 'stroke'
 * | 'all'
 * | 'inherit'
 * )} PointerEventsProperties
 */
