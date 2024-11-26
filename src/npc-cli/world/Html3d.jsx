import * as React from 'react';
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
  eps = 0.001,
  style,
  className,
  distanceFactor,
  castShadow,
  receiveShadow,
  calculatePosition = defaultCalculatePosition,
  wrapperClass,
  ...props
}, ref) => {
    const { gl, camera, scene, size, events } = useThree();

    const state = useStateRef(/** @returns {State} */ () => ({
      group: /** @type {*} */ (null),
      rootDiv: document.createElement('div'),
      reactRoot: /** @type {*} */ (null),
    }));

    React.useMemo(() => 
      void (typeof ref === 'function' ? ref(state) : ref !== null && (ref.current = state))
    , [ref]);

    const oldZoom = React.useRef(0);

    const oldPosition = React.useRef([0, 0])
    // Append to the connected element, which makes HTML work with views
    const target = /** @type {HTMLElement} */ ((events.connected || gl.domElement.parentNode));

    React.useLayoutEffect(() => {
      if (state.group) {
        const currentRoot = (state.reactRoot = ReactDOM.createRoot(state.rootDiv))
        scene.updateMatrixWorld()
        const vec = calculatePosition(state.group, camera, size)
        state.rootDiv.style.cssText = `position:absolute;top:0;left:0;transform:translate3d(${vec[0]}px,${vec[1]}px,0);transform-origin:0 0;`
        if (target) {
          target.appendChild(state.rootDiv)
        }
        return () => {
          if (target) target.removeChild(state.rootDiv)
          currentRoot.unmount()
        }
      }
    }, [target])

    React.useLayoutEffect(() => {
      if (wrapperClass) state.rootDiv.className = wrapperClass
    }, [wrapperClass])

    /** @type {React.CSSProperties} */
    const styles = React.useMemo(() => {
      return {
        position: 'absolute',
        transform: 'none',
        ...style,
      }
    }, [style, size])

    React.useLayoutEffect(() => {
      state.reactRoot?.render(
        <div
          // ref={ref}
          style={styles} className={className} children={children}
        />
      )
    });

    const visible = React.useRef(true)

    useFrame((_gl) => {
      if (state.group) {
        camera.updateMatrixWorld()
        state.group.updateWorldMatrix(true, false)
        const vec = calculatePosition(state.group, camera, size)

        if (
          Math.abs(oldZoom.current - camera.zoom) > eps ||
          Math.abs(oldPosition.current[0] - vec[0]) > eps ||
          Math.abs(oldPosition.current[1] - vec[1]) > eps
        ) {

          const previouslyVisible = visible.current
          visible.current = true;

          if (previouslyVisible !== visible.current) {
            state.rootDiv.style.display = visible.current ? 'block' : 'none'
          }

          const scale = distanceFactor === undefined ? 1 : objectScale(state.group, camera) * distanceFactor
          state.rootDiv.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0) scale(${scale})`

          oldPosition.current = vec
          oldZoom.current = camera.zoom
        }
      }
    });

    return (
      <group {...props} ref={x => x && (state.group = x)} />
    );
  }
);

/**
 * @typedef {Omit<
*   React.HTMLAttributes<HTMLDivElement> & ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group> & {
*   eps?: number;
*   distanceFactor?: number;
*   calculatePosition?: CalculatePosition;
*   wrapperClass?: string;
* }, 'ref'>} Props
*/

/**
* @typedef State
* @property {THREE.Group} group
* @property {HTMLDivElement} rootDiv
* @property {ReactDOM.Root} reactRoot
*/

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()

/**
 * @param {THREE.Object3D} el 
 * @param {THREE.Camera} camera 
 * @param {{ width: number; height: number }} size 
 */
function defaultCalculatePosition(el, camera, size) {
  const objectPos = v1.setFromMatrixPosition(el.matrixWorld)
  objectPos.project(camera)
  const widthHalf = size.width / 2
  const heightHalf = size.height / 2
  return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf]
}

/**
 * @typedef {typeof defaultCalculatePosition} CalculatePosition
 */

/**
 * @param {THREE.Object3D} el 
 * @param {THREE.Camera} camera 
 */
function objectScale(el, camera) {
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
