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
      default: new CMInstance('default', w, { showMeta: true }),
    },
    hide(key, force) {
      const cm = state.lookup[key];
      if (cm.persist === true && force === false) {
        return;
      }
      cm.open = false;
      cm.update();
    },
    show(key) {
      const cm = state.lookup[key];
      cm.open = true;

      // 🚧 move elsewhere?
      const { lastDown } = cm.w.view;
      if (key === 'default' && lastDown) {
        cm.computeKvsFromMeta(lastDown.meta);
        cm.position = lastDown.position.toArray();
      }

      cm.update();
    },
  }));

  w.c = state;

  React.useMemo(() => {// hmr
    process.env.NODE_ENV === 'development' && Object.values(state.lookup).forEach(cm => {
      state.lookup[cm.key] = Object.assign(new CMInstance(cm.key, cm.w, cm.ui), {...cm});
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
 * @property {(cmKey: string, force?: boolean) => void} hide
 * @property {(cmKey: string) => void} show
 */

/**
 * @param {ContextMenuProps} props 
 */
function ContextMenuContent({ cm, cm: { ui } }) {
  return <>
  
    {ui.showMeta && <div className="key-values">
      {ui.kvs.map(({ k, v }) => (
        <div key={k} className="key-value">
          <span className="meta-key">{k}</span>
          {v !== '' && <span className="meta-value">{v}</span>}
        </div>
      ))}
    </div>}

  </>;
}

const contextMenuCss = css`
  
  width: 200px;
  background-color: #000;
  color: #fff;

  .key-values {
    display: flex;
    flex-wrap: wrap;
  }

  .key-value {
    display: flex;
    justify-content: space-around;
    align-items: center;

    flex: 1;
    border: 1px solid #555;
    /* font-family: 'Courier New', Courier, monospace; */

    .meta-key {
      padding: 2px;
    }
    .meta-value {
      padding: 0 4px;
      color: #cca;
      max-width: 128px;
    }
  }
`;

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
      <ContextMenuContent cm={cm} />
    </Html3d>
  );
}

/**
 * @typedef ContextMenuProps
 * @property {CMInstance} cm
 */
/**
 * @typedef ContextMenuUi
 * @property {{ k: string; v: string; length: number; }[]} kvs Key values
 * @property {boolean} showMeta
 */

class CMInstance {

  /** @type {Html3dState} */
  html3d = /** @type {*} */ (null);
  /** Used to hide context menu when camera direction has positive dot product */
  normal = /** @type {undefined | THREE.Vector3} */ (undefined);
  open = false;
  persist = false;
  position = /** @type {[number, number, number]} */ ([0, 0, 0]);
  scale = 1;
  scaled = false;
  tracked = /** @type {null | THREE.Object3D} */ (null);

  /** @type {ContextMenuUi} */
  ui = {
    kvs: [],
    showMeta: false,
  }

  /**
   * @param {string} key
   * @param {import('./World').State} w
   * @param {Partial<ContextMenuUi>} ui
   */
  constructor(key, w, ui) {
    /** @type {string} */ this.key = key;
    /** @type {import('./World').State} */ this.w = w;

    /** @type {ContextMenuUi} */ this.ui = {
      showMeta: ui.showMeta ?? false,
      kvs: ui.kvs ?? [],
    };
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

  /** @param {Geom.Meta} meta */
  computeKvsFromMeta(meta) {
    this.ui.kvs = Object.entries(meta ?? {}).map(([k, v]) => {
      const vStr = v === true ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
    }).sort((a, b) => a.length < b.length ? -1 : 1);
  }

  dispose() {
    this.tracked = null;
    this.update = noop;
    // @ts-ignore
    this.w = null;
    this.html3dRef(null);
  }

  /** @param {null | Html3dState} html3d */
  html3dRef = (html3d) => html3d !== null
    ? this.html3d = html3d // @ts-ignore
    : delete this.html3d

  update = noop
}

/**
 * @typedef {import('../components/Html3d').State} Html3dState
 */

const tmpVector1 = new THREE.Vector3();
function noop() {};
