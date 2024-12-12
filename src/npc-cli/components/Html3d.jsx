import * as React from 'react';
import { cx } from '@emotion/css';
import * as ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { ReactThreeFiber, useFrame, useThree } from '@react-three/fiber'
import useStateRef from '../hooks/use-state-ref';

/**
 * Based on https://github.com/pmndrs/drei/blob/master/src/web/Html.tsx
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const Html3d = React.forwardRef(({
  children,
  className,
  distanceFactor,
  docked,
  open,
  tracked,
  zIndex,
  ...props
}, ref) => {
    const { gl, camera, scene, size, events } = useThree();

    const state = useStateRef(/** @returns {State} */ () => ({
      delta: [0, 0],
      distanceFactor: 0,
      domTarget: null,
      group: /** @type {*} */ (null),
      innerDiv: /** @type {*} */ (null),
      objTarget: null,
      rootDiv: document.createElement('div'),
      reactRoot: /** @type {*} */ (null),
      sign: 0,
      shouldTranslate: false,
      zoom: 0,

      onFrame(_rootState) {
        if (state.shouldTranslate !== true) {
          return;
        }
  
        camera.updateMatrixWorld()
        state.group.updateWorldMatrix(true, false)
        const vec = calculatePosition(/** @type {THREE.Object3D} */ (state.objTarget), camera, size)
  
        // use props.normal to hide when behind
        camera.getWorldDirection(cameraNormal);
        const sign = props.normal !== undefined ? Math.sign(cameraNormal.dot(props.normal)) : -1;
        if (sign !== state.sign) {
          state.sign = sign;
          state.rootDiv.style.display = sign === 1 ? 'none' : 'initial';
        }
  
        if (
          Math.abs(state.zoom - camera.zoom) > eps ||
          Math.abs(state.delta[0] - vec[0]) > eps ||
          Math.abs(state.delta[1] - vec[1]) > eps
        ) {
  
          const scale = distanceFactor === undefined ? 1 : objectScale(state.group, camera) * distanceFactor
          
          state.rootDiv.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0)`;
          state.rootDiv.style.zIndex = `${zIndex ?? ''}`;
  
          if (state.distanceFactor !== distanceFactor) {// 🔔 animate resize on unlock
            state.innerDiv.style.transition = distanceFactor === undefined ? 'transform 300ms' : '';
            state.distanceFactor = distanceFactor;
          }
  
          state.innerDiv.style.transform = `scale(${scale})`;
  
          state.delta = vec;
          state.zoom = camera.zoom;
        }
      }
    }), { deps: [distanceFactor, camera, size] });

    state.shouldTranslate = (
      state.objTarget !== null && state.innerDiv !== null && docked !== true
    );

    React.useImperativeHandle(ref, () => state, []);

    // Append to the connected element, which makes HTML work with views
    state.domTarget = /** @type {HTMLElement} */ ((events.connected || gl.domElement.parentNode));
    state.objTarget = tracked ?? state.group ?? null;

    React.useLayoutEffect(() => {
      if (state.objTarget !== null) {
        const currentRoot = (state.reactRoot = ReactDOM.createRoot(state.rootDiv))
        scene.updateMatrixWorld()
        const vec = calculatePosition(state.objTarget, camera, size)
        state.rootDiv.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0)`;
        if (state.domTarget) {
          state.domTarget.appendChild(state.rootDiv)
        }
        return () => {
          if (state.domTarget) state.domTarget.removeChild(state.rootDiv)
          currentRoot.unmount() // 🔔 breaks HMR of children onchange this file
        }
      }
    }, [state.domTarget, state.objTarget])

    /** @type {React.CSSProperties} */
    React.useEffect(() => {
      if (state.rootDiv) {
        state.rootDiv.style.visibility = open ? 'visible' : 'hidden';
        state.rootDiv.className = cx(className, { docked });
      }
    }, [state.rootDiv, open, docked, className]);

    React.useLayoutEffect(() => {
      state.reactRoot?.render(
        <div
          ref={state.ref('innerDiv')}
          children={children}
        />
      );

      // Force update for (a) paused, (b) window resize
      setTimeout(() => {
        state.zoom = 0;
        state.onFrame();
      });
    });

    useFrame(state.onFrame);

    return (
      <group
        {...props}
        ref={state.ref('group')}
      />
    );
  }
);

/**
 * @typedef {Omit<
 *   React.HTMLAttributes<HTMLDivElement> &
 *   ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group> & BaseProps,
 * 'ref'>} Props
*/

/**
 * @typedef BaseProps
 * @property {boolean} [docked]
 * @property {number} [distanceFactor]
 * @property {THREE.Vector3} [normal]
 * @property {boolean} open
 * @property {THREE.Object3D} [tracked]
 * @property {number} [zIndex]
 */

/**
* @typedef State
* @property {[number, number]} delta 2D translation
* @property {null | HTMLElement} domTarget
* @property {number | undefined} distanceFactor
* @property {THREE.Group} group
* @property {HTMLDivElement} innerDiv
* @property {null | THREE.Object3D} objTarget
* @property {HTMLDivElement} rootDiv
* @property {ReactDOM.Root} reactRoot
* @property {number} sign
* @property {boolean} shouldTranslate
* @property {number} zoom
* @property {(rootState?: import('@react-three/fiber').RootState) => void} onFrame
*/

const eps = 0.001;
const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()

/**
 * @param {THREE.Object3D} el 
 * @param {THREE.Camera} camera 
 * @param {{ width: number; height: number }} size 
 * @returns {[number, number]}
 */
function calculatePosition(el, camera, size) {
  // 🤔 support tracked offset vector?
  const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
  objectPos.project(camera);
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
}

/**
 * @param {THREE.Object3D} el 
 * @param {THREE.Camera} camera 
 */
export function objectScale(el, camera) {
  if (camera instanceof THREE.OrthographicCamera) {
    return camera.zoom
  } else if (camera instanceof THREE.PerspectiveCamera) {
    const objectPos = v1.setFromMatrixPosition(el.matrixWorld)
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

const cameraNormal = new THREE.Vector3();
