import React from "react";
import { css } from "@emotion/css";
import * as THREE from "three";
import { stringify as javascriptStringify } from 'javascript-stringify';

import { mapValues, tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d, objectScale } from "../components/Html3d";

export default function ContextMenus() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {},
    savedOpts: tryLocalStorageGetParsed(`context-menus@${w.key}`) ?? {},
    topLinks: { default: [
      { key: 'toggle-kvs', label: 'meta', test: 'showKvs' },
      { key: 'toggle-pinned', label: 'pin', test: 'pinned' },
      { key: 'toggle-scaled', label: 'scale', test: 'scaled' },
      { key: 'close', label: 'exit' },
    ], saved: [
      { key: 'toggle-kvs', label: 'meta', test: 'showKvs' },
      { key: 'toggle-scaled', label: 'scale', test: 'scaled' },
      { key: 'delete', label: 'exit' },
    ]},
    delete(cmKey) {
      if (cmKey === 'default') {
        return false; // Cannot delete default
      }
      const success = delete state.lookup[cmKey];
      update();
      return success;
    },
    getNextKey() {
      let n = 0;
      while (n in state.lookup) n++;
      return `${n}`;
    },
    hide(key, force) {
      const cm = state.lookup[key];
      if (cm.pinned === true && force !== true) {
        return;
      }
      cm.open = false;
      cm.update();
    },
    saveDefault() {
      const defCm = state.lookup.default;
      const cmKey = state.getNextKey();
      const dstCm = state.lookup[cmKey] = new CMInstance(cmKey, w, {
        showKvs: defCm.showKvs,
      });
      dstCm.setContext({
        meta: defCm.meta,
        position: new THREE.Vector3(...defCm.position),
      });
      defCm.open = false;
      dstCm.open = true;
      // violate default memo
      defCm.epochMs = Date.now();
      update();
    },
    saveOpts() {
      tryLocalStorageSet(`context-menus@${w.key}`, JSON.stringify(
        mapValues(state.lookup, ({ pinned, showKvs }) => ({ pinned, showKvs }))
      ));
    },
    show(key, ct) {
      const cm = state.lookup[key];
      if (ct !== undefined) {
        cm.setContext(ct);
      }
      cm.open = true;
      cm.update();
    },
  }), { reset: { lookup: false } });

  w.c = state;

  React.useMemo(() => {// HMR
    state.lookup.default ??= new CMInstance('default', w, { showKvs: true });

    process.env.NODE_ENV === 'development' && Object.values(state.lookup).forEach(cm => {
      state.lookup[cm.key] = Object.assign(new CMInstance(cm.key, cm.w, cm.ui), {...cm});
      cm.dispose();
    });
  }, []);

  const update = useUpdate();

  return Object.values(state.lookup).map(cm =>
    <MemoizedContextMenu key={cm.key} cm={cm} epochMs={cm.epochMs}/>
  );
}

/**
 * @typedef State
 * @property {{ [cmKey: string]: CMInstance }} lookup
 * @property {{ [cmKey: string]: Pick<CMInstance, 'pinned' | 'showKvs'> }} savedOpts
 * @property {Record<'default' | 'saved', NPC.ContextMenuLink[]>} topLinks
 *
 * @property {(cmKey: string) => boolean} delete
 * @property {() => string} getNextKey
 * @property {(cmKey: string, force?: boolean) => void} hide
 * @property {() => void} saveDefault
 * @property {() => void} saveOpts
 * @property {(cmKey: string, ct?: NPC.ContextMenuContextDef) => void} show
 */

/**
 * @param {ContextMenuProps} props 
 */
function ContextMenuContent({ cm, cm: { ui, w } }) {

  return <>
  
    <div className="top-bar">

     {cm.key === 'default'
        ? <button onClick={w.c.saveDefault}>save</button>
        : <span className="saved-cm-key">{cm.key}</span>
     }

      <div className="links" onClick={cm.onClickLink.bind(cm)}>
        {w.c.topLinks[cm.key === 'default' ? 'default' : 'saved'].map(({ key, label, test }) =>
          <button
            key={key}
            data-key={key}
            className={test !== undefined && !(/** @type {*} */ (cm)[test]) ? 'off' : undefined}
          >
            {label}
          </button>
        )}
      </div>
    </div>

    <div className="links" onClick={cm.onClickLink.bind(cm)}>
      {ui.links.map(({ key, label, test }) =>
        <button
          key={key}
          data-key={key}
          className={test !== undefined && !(/** @type {*} */ (cm)[test]) ? 'off' : undefined}
        >
          {label}
        </button>
      )}
    </div>

    {cm.showKvs === true && <div className="kvs">
      {ui.kvs.map(({ k, v }) => (
        <div key={k} className="kv">
          <span className="key">{k}</span>
          {v !== '' && <span className="value">{v}</span>}
        </div>
      ))}
    </div>}

  </>;
}

const contextMenuCss = css`
  left: 0;
  top: 0;
  width: 200px;

  background-color: #000;
  color: #fff;
  letter-spacing: 1px;
  font-size: smaller;
  border: 1px solid #dddddd77;

  .top-bar {
    display: flex;
    justify-content: space-between;
    padding: 0 4px;
  }

  .saved-cm-key {
    color: #ff7;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    
    line-height: normal;
    gap: 4px;
    padding: 1px 0;
    padding-left: 4px;

  }

  button {
    text-decoration: underline;
    color: #aaf;
  }
  button.off {
    filter: brightness(0.7);
  }

  .kvs {
    display: flex;
    flex-wrap: wrap;
  }

  .kv {
    display: flex;
    justify-content: space-around;
    align-items: center;

    flex: 1;
    border: 1px solid #555;
    /* font-family: 'Courier New', Courier, monospace; */

    .key {
      padding: 2px;
    }
    .value {
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

  React.useEffect(() => {
    // Need extra initial render e.g. when paused
    // Also trigger CSS transition on scaled:=false
    cm.update();
  }, [cm.scaled]);

  return (
    <Html3d
      ref={cm.html3dRef.bind(cm)}
      calculatePosition={cm.calculatePosition}
      className={contextMenuCss}
      distanceFactor={cm.scaled ? cm.scale : undefined}
      position={cm.position}
      normal={cm.normal}
      open={cm.open}
      tracked={cm.tracked}
      zIndex={cm.key === 'default' ? 1 : undefined}
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
 * 🔔 HMR breaks for function-as-property (e.g. for lexical binding)
 * @typedef ContextMenuUi
 * @property {{ k: string; v: string; length: number; }[]} kvs
 * Key values e.g. of last clicked meta
 * @property {NPC.ContextMenuLink[]} links
 */

class CMInstance {

  /** @type {Html3dState} */
  html3d = /** @type {*} */ (null);
  /** Used to hide context menu when camera direction has positive dot product */
  normal = /** @type {undefined | THREE.Vector3} */ (undefined);
  scale = 1;
  tracked = /** @type {undefined | THREE.Object3D} */ (undefined);
  /** For violating React.memo */
  epochMs = 0;
  
  meta = /** @type {Geom.Meta} */ ({});
  position = /** @type {[number, number, number]} */ ([0, 0, 0]);

  open = false;
  pinned = false;
  scaled = false;
  showKvs = false;

  /** @type {ContextMenuUi} */
  ui = {
    kvs: [],
    links: [],
  }

  /**
   * @param {string} key
   * @param {import('./World').State} w
   * @param {Partial<ContextMenuUi> & { pinned?: boolean; showKvs?: boolean }} opts
   */
  constructor(key, w, opts) {
    /** @type {string} */ this.key = key;
    /** @type {import('./World').State} */ this.w = w;

    const prevOpts = w.c.savedOpts[key] ?? {};
    this.pinned = opts.pinned ?? prevOpts.pinned ?? w.smallViewport;
    this.scaled = false,
    this.showKvs = opts.showKvs ?? prevOpts.showKvs ?? false,

    /** @type {ContextMenuUi} */ this.ui = {
      kvs: opts.kvs ?? [],
      links: opts.links ?? [],
    };
  }

  /**
   * @param {THREE.Object3D} el 
   * @param {THREE.Camera} camera 
   * @param {{ width: number; height: number }} size 
   * @returns {[number, number]}
   */
  calculatePosition(el, camera, size) {
    // 🤔 support tracked offset vector?
    const objectPos = tmpVector1.setFromMatrixPosition(el.matrixWorld);
    objectPos.project(camera);
    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;
    return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
  }

  /** @param {Geom.Meta} meta */
  computeKvsFromMeta(meta) {
    const skip = /** @type {Record<string, boolean>} */ ({
      doorId: 'gdKey' in meta,
      gmId: 'gdKey' in meta || 'grKey' in meta,
      obsId: true,
      picked: true,
      roomId: 'grKey' in meta,
    });
    this.ui.kvs = Object.entries(meta ?? {}).flatMap(([k, v]) => {
      if (skip[k] === true) return [];
      const vStr = v === true ? '' : typeof v === 'string' ? v : javascriptStringify(v) ?? '';
      return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
    }).sort((a, b) => a.length < b.length ? -1 : 1);
  }

  dispose() {
    this.tracked = undefined;
    this.update = noop;
    // @ts-ignore
    this.w = null;
    this.html3dRef(null);
  }

  /** @param {null | Html3dState} html3d */
  html3dRef(html3d) {// @ts-ignore
    return html3d !== null ? this.html3d = html3d : delete this.html3d;
  }

  /** @param {React.MouseEvent} e */
  onClickLink(e) {
    const button = /** @type {HTMLButtonElement} */ (e.target);
    const linkKey = button.dataset.key ?? 'unknown';
    this.w.events.next({ key: 'click-link', cmKey: this.key, linkKey }); // 🚧
  }

  /**
   * Context is world position and meta concerning said position
   * @param {NPC.ContextMenuContextDef} ct 
   */
  setContext({ position, meta }) {
    this.meta = meta;
    this.position = position.toArray();
    this.computeKvsFromMeta(meta);
  }

  toggleKvs() {
    this.showKvs = !this.showKvs;
  }

  togglePinned() {
    this.pinned = !this.pinned;
  }

  /** Ensure smooth transition when start scaling */
  toggleScaled() {
    this.scaled = !this.scaled;
    this.scale = this.scaled === true ? 1 / objectScale(this.html3d.group, this.w.r3f.camera) : 1;
  }

  update = noop
}

/**
 * @typedef {import('../components/Html3d').State} Html3dState
 */

/**
 * @typedef {typeof CMInstance} CMInstanceType
 */

const tmpVector1 = new THREE.Vector3();
function noop() {};