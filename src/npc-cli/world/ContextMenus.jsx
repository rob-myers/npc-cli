import React from "react";
import * as THREE from "three";

import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import { Html3d } from "../components/Html3d";

export default function ContextMenus() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {
      default: new ContextMenuData('default'),
    },
  }));

  w.c = state;

  React.useEffect(() => {// hmr
    process.env.NODE_ENV === 'development' && Object.values(state.lookup).forEach(cm => {
      state.lookup[cm.key] = Object.assign(new ContextMenuData(cm.key), {...cm});
      cm.dispose();
    });
  }, []);

  return Object.values(state.lookup).map(cmData =>
    <MemoizedContextMenu
      key={cmData.key}
      cmData={cmData}
      epochMs={0} // never override memo?
    />
  );
}

/**
 * @typedef State
 * @property {{ [cmKey: string]: ContextMenuData }} lookup
 */

/** @type {React.MemoExoticComponent<(props: ContextMenuProps & { epochMs: number }) => JSX.Element>} */
const MemoizedContextMenu = React.memo(ContextMenu);

/**
 * @param {ContextMenuProps} props
 */
function ContextMenu({ cmData }) {
  return (
    <Html3d
    // className="context-menu"
      ref={cmData.ref}
      calculatePosition={cmData.calculatePosition}
      
      distanceFactor={cmData.scaled ? cmData.scale : undefined}
      position={cmData.position}
      // normal={cmData.normal ?? undefined} // for hiding
      // visible={state.open}
    >
    </Html3d>
  );
}

/**
 * @typedef ContextMenuProps
 * @property {ContextMenuData} cmData
 */

const tmpVector1 = new THREE.Vector3();


class ContextMenuData {// 🚧

  /** @type {Html3dState} */
  html = /** @type {*} */ (null);
  /** @type {[number, number, number]} */
  position = [0, 0, 0];
  scale = 1;
  scaled = false;
  /** @type {null | THREE.Object3D} */
  tracked = null;

  /** @param {string} key */
  constructor(key) {
    /** @type {string} */
    this.key = key;
  }

  /**
   * @param {THREE.Object3D} el 
   * @param {THREE.Camera} camera 
   * @param {{ width: number; height: number }} size 
   * @returns {[number, number]}
   */
  calculatePosition = (el, camera, size) => {
    // 🤔 support tracked offset vector?
    const objectPos = tmpVector1.setFromMatrixPosition(
      this.tracked === null ? el.matrixWorld : this.tracked.matrixWorld
    );
    objectPos.project(camera);
    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;
    return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
  }

  dispose() {
    this.tracked = null;
    this.ref(null);
  }

  /** @param {null | Html3dState} html */
  ref = (html) => {
    Object.assign(this, { html });
  }

}

/**
 * @typedef {import('../components/Html3d').State} Html3dState
 */