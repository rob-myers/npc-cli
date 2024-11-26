import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { ReactThreeFiber, useFrame, useThree } from '@react-three/fiber'

/**
 * Based on https://github.com/pmndrs/drei/blob/master/src/web/Html.tsx
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const Html3d = React.forwardRef(
  (
    {
      children,
      eps = 0.001,
      style,
      className,
      distanceFactor,
      castShadow,
      receiveShadow,
      calculatePosition = defaultCalculatePosition,
      as = 'div',
      wrapperClass,
      ...props
    },
    ref, // 🚧
  ) => {
    const { gl, camera, scene, size, events } = useThree()

    const [el] = React.useState(() => document.createElement(as))
    /** @type {React.MutableRefObject<ReactDOM.Root | undefined>} */
    const root = React.useRef();
    /** @type {React.RefObject<THREE.Group>} */
    const group = React.useRef(null)
    const oldZoom = React.useRef(0)
    const oldPosition = React.useRef([0, 0])
    /** @type {React.RefObject<HTMLDivElement>} */
    const transformOuterRef = React.useRef(null)
    /** @type {React.RefObject<HTMLDivElement>} */
    const transformInnerRef = React.useRef(null)
    // Append to the connected element, which makes HTML work with views
    const target = /** @type {HTMLElement} */ ((events.connected || gl.domElement.parentNode));

    const isMeshSizeSet = React.useRef(false);

    React.useLayoutEffect(() => {
      if (group.current) {
        const currentRoot = (root.current = ReactDOM.createRoot(el))
        scene.updateMatrixWorld()
        const vec = calculatePosition(group.current, camera, size)
        el.style.cssText = `position:absolute;top:0;left:0;transform:translate3d(${vec[0]}px,${vec[1]}px,0);transform-origin:0 0;`
        if (target) {
          target.appendChild(el)
        }
        return () => {
          if (target) target.removeChild(el)
          currentRoot.unmount()
        }
      }
    }, [target])

    React.useLayoutEffect(() => {
      if (wrapperClass) el.className = wrapperClass
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
      isMeshSizeSet.current = false
      root.current?.render(
        <div
          // ref={ref}
          style={styles} className={className} children={children}
        />
      )
    });

    const visible = React.useRef(true)

    useFrame((gl) => {
      if (group.current) {
        camera.updateMatrixWorld()
        group.current.updateWorldMatrix(true, false)
        const vec = calculatePosition(group.current, camera, size)

        if (
          Math.abs(oldZoom.current - camera.zoom) > eps ||
          Math.abs(oldPosition.current[0] - vec[0]) > eps ||
          Math.abs(oldPosition.current[1] - vec[1]) > eps
        ) {

          const previouslyVisible = visible.current
          visible.current = true;

          if (previouslyVisible !== visible.current) {
            el.style.display = visible.current ? 'block' : 'none'
          }

          el.style.zIndex = '0';

          const scale = distanceFactor === undefined ? 1 : objectScale(group.current, camera) * distanceFactor
          el.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0) scale(${scale})`

          oldPosition.current = vec
          oldZoom.current = camera.zoom
        }
      }
    })

    return (
      <group {...props} ref={group} />
    );
  }
);

/**
 * @typedef {Omit<
*   React.HTMLAttributes<HTMLDivElement> & ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group> & {
*   eps?: number;
*   distanceFactor?: number;
*   calculatePosition?: CalculatePosition;
*   as?: string;
*   wrapperClass?: string;
* }, 'ref'>} Props
*/

/**
* @typedef State
* @property {HTMLDivElement} div
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
