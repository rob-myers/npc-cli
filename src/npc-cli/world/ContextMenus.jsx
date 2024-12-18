import React from "react";
import * as THREE from "three";
import { stringify as javascriptStringify } from 'javascript-stringify';

import { mapValues, tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d, objectScale } from "../components/Html3d";
import { DefaultContextMenu, defaultContextMenuCss, NpcContextMenu, npcContextMenuCss } from "./ContextMenuUi";

export default function ContextMenus() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {},
    savedOpts: tryLocalStorageGetParsed(`context-menus@${w.key}`) ?? {},

    delete(...cmKeys) {
      for (const cmKey of cmKeys) {
        const cm = state.lookup[cmKey];
        if (cmKey === 'default') {
          continue; // Cannot delete default
        }
        if (cm !== undefined) {
          cm.tracked = undefined;
          delete state.lookup[cmKey];
          update();
          true;
        }
      }
    },
    hide(key, force) {
      const cm = state.lookup[key];
      if (cm.pinned === true && force !== true) {
        return;
      }
      cm.open = false;
      cm.update();
    },
    saveOpts() {// only need to save default?
      tryLocalStorageSet(`context-menus@${w.key}`, JSON.stringify(
        mapValues(state.lookup, ({ pinned, showKvs, docked }) => ({ pinned, showKvs, docked }))
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
    trackNpc(npcKey) {
      if (npcKey in w.n) {
        const cmKey = npcKeyToCmKey(npcKey);
        const cm = state.lookup[cmKey] ??= new CMInstance(cmKey, w, { showKvs: false, pinned: true, npcKey });
        cm.tracked = w.n[npcKey].m.group;
        cm.open = true;
        update();
      } else {
        throw Error(`ContextMenus.trackNpc: npc not found: "${npcKey}"`);
      }
    },
  }));

  w.c = state;
  w.cm = state.lookup.default ??= new CMInstance('default', w, { showKvs: true });

  React.useMemo(() => {// HMR
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
 * @property {{ [cmKey: string]: Pick<CMInstance, 'docked' | 'pinned' | 'showKvs'> }} savedOpts
 *
 * @property {(npcKey: string) => void} trackNpc Add speech bubble for specific npc
 * @property {(...cmKeys: string[]) => void} delete
 * @property {(cmKey: string, force?: boolean) => void} hide
 * @property {() => void} saveOpts
 * @property {(cmKey: string, ct?: NPC.ContextMenuContextDef) => void} show
 */

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

  // 🚧 10 -> initial distance from camera
  const baseScale = cm.key === 'default' ? cm.baseScale : 10;

  return (
    <Html3d
      ref={cm.html3dRef.bind(cm)}
      className={cm.key === 'default' ? defaultContextMenuCss: npcContextMenuCss}
      baseScale={baseScale}
      docked={cm.docked}
      position={cm.position}
      normal={cm.normal}
      open={cm.open}
      tracked={cm.tracked}
      zIndex={cm.key === 'default' ? 1 : undefined}
    >
      {cm.key === 'default'
        ? <DefaultContextMenu cm={cm} />
        : <NpcContextMenu cm={cm} />
      }
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

export class CMInstance {

  /** @type {Html3dState} */
  html3d = /** @type {*} */ (null);
  /** Used to hide context menu when camera direction has positive dot product */
  normal = /** @type {undefined | THREE.Vector3} */ (undefined);
  baseScale = /** @type {undefined | number} */ (undefined);
  tracked = /** @type {undefined | THREE.Object3D} */ (undefined);
  /** For violating React.memo */
  epochMs = 0;
  
  match = /** @type {{ [matcherKey: string]: NPC.ContextMenuMatcher}} */ ({});
  meta = /** @type {Geom.Meta} */ ({});
  npcKey = /** @type {undefined | string} */ (undefined);
  position = /** @type {[number, number, number]} */ ([0, 0, 0]);

  docked = false;
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
   * @param {Partial<ContextMenuUi> & {
   *   npcKey?: string;
   *   pinned?: boolean;
   *   showKvs?: boolean;
   * }} opts
   */
  constructor(key, w, opts) {
    /** @type {string} */ this.key = key;
    /** @type {import('./World').State} */ this.w = w;

    const prevOpts = w.c.savedOpts[key] ?? {};
    this.pinned = opts.pinned ?? prevOpts.pinned ?? w.smallViewport;
    this.scaled = false,
    this.showKvs = opts.showKvs ?? prevOpts.showKvs ?? false,
    this.npcKey = opts.npcKey;

    /** @type {ContextMenuUi} */ this.ui = {
      kvs: opts.kvs ?? [],
      links: opts.links ?? [],
    };
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

  /**
   * Apply matchers, assuming `this.meta` is up-to-date.
   */
  computeLinks() {
    let suppressKeys = /** @type {string[]} */ ([]);
    const keyToLink = Object.values(this.match).reduce((agg, matcher) => {
      const { showLinks, hideKeys } = matcher(this);
      showLinks?.forEach(link => agg[link.key] = link);
      suppressKeys.push(...hideKeys ?? []);
      return agg;
    }, /** @type {{ [linkKey: string]: NPC.ContextMenuLink }} */ ({}));
    suppressKeys.forEach(key => delete keyToLink[key]);
    this.ui.links = Object.values(keyToLink);
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

    this.w.view.rootEl.focus();
    this.w.events.next({ key: 'click-link', cmKey: this.key, linkKey });

    switch (linkKey) {
      // case 'delete': w.c.delete(e.cmKey); break;
      case 'clear-npc': this.setNpc(); break;
      case 'toggle-docked': this.toggleDocked(); break;
      case 'toggle-kvs': this.toggleKvs(); break;
      case 'toggle-pinned': this.togglePinned(); break;
      case 'toggle-scaled': this.toggleScaled(); break;
    }

    this.w.c.saveOpts();
    this.update();
  }

  /**
   * Context is world position and meta concerning said position
   * @param {NPC.ContextMenuContextDef} ct 
   */
  setContext({ position, meta }) {
    this.meta = meta;
    this.position = position.toArray();
    this.computeKvsFromMeta(meta);
    this.computeLinks();
  }

  /** @param {string} [npcKey] */
  setNpc(npcKey) {
    this.npcKey = npcKey;
    this.update();
  }

  toggleDocked() {
    this.docked = !this.docked;
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
    this.baseScale = this.scaled === true ? 1 / objectScale(this.html3d.group, this.w.r3f.camera) : undefined;
  }

  update = noop
}

/**
 * @typedef {import('../components/Html3d').State} Html3dState
 */

const tmpVector1 = new THREE.Vector3();
function noop() {};

/**
 * @param {string} npcKey 
 */
export function npcKeyToCmKey(npcKey) {
  return `@${npcKey}`;
}
