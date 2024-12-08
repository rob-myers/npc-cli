import React from "react";
import { css } from "@emotion/css";
import * as THREE from "three";

import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d } from "../components/Html3d";

export default function ContextMenus() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {
      default: new CMInstance('default'),
    },
    hide(key) {
      const cm = state.lookup[key];
      cm.open = false;
      cm.update();
    },
    show(key) {
      const cm = state.lookup[key];
      cm.open = true;
      cm.update();
    },
  }));

  w.c = state;

  React.useMemo(() => {// hmr
    process.env.NODE_ENV === 'development' && Object.values(state.lookup).forEach(cm => {
      state.lookup[cm.key] = Object.assign(new CMInstance(cm.key), {...cm});
      cm.dispose();
    });
  }, []);

  return Object.values(state.lookup).map(cm =>
    <MemoizedContextMenu
      key={cm.key}
      cm={cm}
      epochMs={0} // never override memo?
    />
  );
}

/**
 * @typedef State
 * @property {{ [cmKey: string]: CMInstance }} lookup
 * @property {(cmKey: string) => void} hide
 * @property {(cmKey: string) => void} show
 */

/** @type {React.MemoExoticComponent<(props: ContextMenuProps & { epochMs: number }) => JSX.Element>} */
const MemoizedContextMenu = React.memo(ContextMenu);

/**
 * @param {ContextMenuProps} props
 */
function ContextMenu({ cm }) {

  cm.update = useUpdate();

  return (
    <Html3d
      ref={cm.html3dRef}
      calculatePosition={cm.calculatePosition}
      className={contextMenuCss}
      distanceFactor={cm.scaled ? cm.scale : undefined}
      position={cm.position}
      normal={cm.normal}
      open={cm.open}
    >
      {/* 🚧 */}
      FooBarBaz
    </Html3d>
  );
}

/**
 * @typedef ContextMenuProps
 * @property {CMInstance} cm
 */

const contextMenuCss = css`
  color: red;
`;

class CMInstance {

  /** @type {Html3dState} */
  html3d = /** @type {*} */ (null);
  /** @type {undefined | THREE.Vector3} */
  normal = undefined;
  open = false;
  /** @type {[number, number, number]} */
  position = [0, 0, 0];
  scale = 1;
  scaled = false;
  /** @type {null | THREE.Object3D} */
  tracked = null;

  /** @param {string} key */
  constructor(key) {
    /** @type {string} */ this.key = key;
  }

  /**
   * @param {THREE.Object3D} el 
   * @param {THREE.Camera} camera 
   * @param {{ width: number; height: number }} size 
   * @returns {[number, number]}
   */
  calculatePosition = (el, camera, size) => {
    // 🤔 support tracked offset vector?
    const matrix = this.tracked === null ? el.matrixWorld : this.tracked.matrixWorld;
    const objectPos = tmpVector1.setFromMatrixPosition(matrix);
    objectPos.project(camera);
    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;
    return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
  }

  dispose() {
    this.tracked = null;
    this.html3dRef(null);
  }

  /** @param {null | Html3dState} html3d */
  html3dRef = (html3d) => html3d !== null
    ? this.html3d = html3d // @ts-ignore
    : delete this.html3d

  update() {};
}

/**
 * @typedef {import('../components/Html3d').State} Html3dState
 */

const tmpVector1 = new THREE.Vector3();
