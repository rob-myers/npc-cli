import * as React from 'react';
import { css, cx } from '@emotion/css';
import * as ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber'
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
  offset,
  position,
  r3f,
  tracked,
  visible,
}, ref) => {

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
  
        r3f.camera.updateMatrixWorld();
        const vec = state.computePosition();

        if (
          Math.abs(state.zoom - r3f.camera.zoom) > eps ||
          Math.abs(state.delta[0] - vec[0]) > eps ||
          Math.abs(state.delta[1] - vec[1]) > eps
        ) {
          state.rootDiv.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0)`;
          
          if (state.baseScale !== baseScale) {
            if (baseScale === undefined) {// animate on baseScale:=undefined
              state.innerDiv.style.transition = 'transform 300ms';
              state.innerDiv.style.transform = 'scale(1)';
            } else {
              state.innerDiv.style.transition = '';
            }
            state.baseScale = baseScale;
          }
          
          if (baseScale !== undefined) {
            tracked === null ? v1.copy(position) : v1.setFromMatrixPosition(tracked.matrixWorld);
            const scale = objectScale(v1, r3f.camera) * baseScale;
            state.innerDiv.style.transform = `scale(${scale})`;
          }
  
          state.delta = vec;
          state.zoom = r3f.camera.zoom;
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
        return calculatePosition(v1, r3f.camera, r3f.get().size);
      },

    }), { deps: [baseScale, docked, offset, position, tracked] });

    React.useImperativeHandle(ref, () => state, []);

    state.domTarget = /** @type {HTMLElement | null} */ (
      r3f.gl.domElement.parentNode?.parentNode ?? null // w.view.rootEl
    );

    React.useLayoutEffect(() => {
      const currentRoot = (state.reactRoot = ReactDOM.createRoot(state.rootDiv));
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

    React.useLayoutEffect(() => {
      if (docked ? state.innerDiv : state.rootDiv) {
        state.rootDiv.style.visibility = visible ? 'visible' : 'hidden';
        state.rootDiv.className = cx(rootCss, { docked }, className);
      }
    }, [state.rootDiv, state.innerDiv, className, docked, visible]);

    useFrame(state.onFrame);

    return null;
  }
);

/**
 * @typedef {Omit<React.HTMLAttributes<HTMLDivElement> & BaseProps, 'ref'>} Props
 */

/**
 * @typedef BaseProps
 * @property {boolean} [docked]
 * @property {number} [baseScale]
 * @property {THREE.Vector3Like} [offset]
 * @property {import("@react-three/fiber").RootState } r3f
 * @property {THREE.Vector3} position
 * @property {THREE.Object3D | null} tracked
 * @property {boolean} visible
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

export const html3DOpacityCssVar = '--html-3d-opacity';

const rootCss = css`
  &:not(.docked) {
    transition: opacity ease-out 200ms;
    opacity: var(${html3DOpacityCssVar});
  }
`;

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
