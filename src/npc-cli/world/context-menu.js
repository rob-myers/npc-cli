import * as THREE from "three";
import { stringify as javascriptStringify } from 'javascript-stringify';
import { tryLocalStorageGetParsed, tryLocalStorageSet, warn } from "../service/generic";
import { objectScale } from "../components/Html3d";

/**
 * 🔔 Avoid `foo = (...bar) => baz` because incompatible with our approach to HMR.
 */
class BaseContextMenu {

  baseScale = /** @type {undefined | number} */ (undefined);
  /** For violating React.memo */
  epochMs = 0;
  
  position = /** @type {[number, number, number]} */ ([0, 0, 0]);
  tracked = /** @type {undefined | THREE.Object3D} */ (undefined);
  offset = /** @type {undefined | THREE.Vector3Like} */ (undefined);
  
  docked = false;
  open = false;
  pinned = false;
  scaled = false;
  showKvs = false;

  /** @type {import('../components/Html3d').State} */
  html3d = /** @type {*} */ (null);

  /**
   * @param {string} key
   * @param {import('./World').State} w
   * @param {Partial<Pick<BaseContextMenu, 'showKvs' | 'pinned'>>} opts
   */
  constructor(key, w, opts) {
    /** @type {string} */ this.key = key;
    /** @type {import('./World').State} */ this.w = w;

    this.pinned = opts.pinned ?? w.smallViewport;
    this.scaled = false;
    this.showKvs = opts.showKvs ?? false;
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
    this.kvs = Object.entries(meta ?? {}).flatMap(([k, v]) => {
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

  /** @param {boolean} [force] */
  hide(force) {
    if (this.pinned === true && force !== true) {
      return;
    }
    this.open = false;
    this.update();
  }

  /** @param {null | import('../components/Html3d').State} html3d */
  html3dRef(html3d) {
    return html3d !== null
      ? this.html3d = html3d // @ts-ignore
      : delete this.html3d;
  }

  /** @param {React.MouseEvent} e */
  onClickLink(e) {
    const el = /** @type {HTMLElement} */ (e.target);
    const linkKey = el.dataset.key;

    if (linkKey === undefined) {
      return warn(`${'onClick'}: ignored el ${el.tagName} with class ${el.className}`);
    }

    this.w.view.rootEl.focus();
    this.w.events.next({ key: 'click-link', cmKey: this.key, linkKey });

    switch (linkKey) {
      // case 'delete': w.c.delete(e.cmKey); break;
      case 'clear-npc': this.setNpc(); break;
      case 'hide': this.hide(true); break;
      case 'toggle-docked': this.toggleDocked(); break;
      case 'toggle-kvs': this.toggleKvs(); break;
      case 'toggle-pinned': this.togglePinned(); break;
      case 'toggle-scaled': this.toggleScaled(); break;
    }

    this.w.cm.persist();
    this.update();
  }

  /** @param {null | import('../components/PopUp').State} popUp */
  popUpRef(popUp) {
    return popUp !== null
      ? this.popUp = popUp // @ts-ignore
      : delete this.popUp;
  }

  /** @param {string} [npcKey] */
  setNpc(npcKey) {
    this.npcKey = npcKey;
    this.update();
  }

  /**
   * @param {THREE.Object3D} [input] 
   */
  setTracked(input) {
    this.tracked = input;
  }

  toggleDocked() {
    this.docked = !this.docked;
    if (this.docked === true) {
      this.scaled === true && this.toggleScaled();
      this.popUp?.close();
    }
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
    this.baseScale = this.scaled === true ? 1 / objectScale(this.html3d.objTarget, this.w.r3f.camera) : undefined;
  }

  update = noop
}

export class DefaultContextMenu extends BaseContextMenu {
  /** @type {import('../components/PopUp').State} */
  popUp = /** @type {*} */ (null);

  /** @type {ContextMenuUi['kvs']} */
  kvs = [];
  /** @type {ContextMenuUi['links']} */
  links = [];
  match = /** @type {{ [matcherKey: string]: NPC.ContextMenuMatcher}} */ ({});
  meta = /** @type {Geom.Meta} */ ({});
  npcKey = /** @type {undefined | string} */ (undefined);

  selectNpcKeys = /** @type {string[]} */ ([]);

  /**
   * @param {string} key
   * @param {import('./World').State} w
   * @param {Partial<Pick<BaseContextMenu, 'showKvs' | 'npcKey' | 'pinned'>>} opts
   */
  constructor(key, w, opts) {
    super(key, w, opts);

    /** @type {null | Pick<BaseContextMenu, 'docked' | 'pinned' | 'showKvs'>} */
    const savedOpts = tryLocalStorageGetParsed(`default-context-menu@${w.key}`);
    this.pinned = opts.pinned ?? savedOpts?.pinned ?? w.smallViewport;
    this.scaled = false;
    this.showKvs = opts.showKvs ?? savedOpts?.showKvs ?? false;

    this.npcKey = opts.npcKey;
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
    this.links = Object.values(keyToLink);
  }

  /**
   * @param {React.ChangeEvent<HTMLSelectElement> } e 
   */
  onSelectNpc(e) {
    const { value } = e.currentTarget;
    this.npcKey = value in this.w.n ? value : undefined;
    this.refreshPopup();
  }

  /** @param {boolean} willOpen  */
  onTogglePopup(willOpen) {
    if (willOpen) {
      this.refreshPopup();
    }
  }

  persist() {
    const { pinned, showKvs, docked } = this;
    tryLocalStorageSet(`default-context-menu@${this.w.key}`, JSON.stringify({
      pinned, showKvs, docked,
    }));
  }
  
  refreshPopup() {
    this.selectNpcKeys = Object.keys(this.w.n);
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

  /** @param {number} opacity  */
  setOpacity(opacity) {
    this.html3d.rootDiv.style.opacity = `${opacity}`;
  }

  show() {
    this.open = true;
    this.update();
  }
}

export class NpcSpeechBubble extends BaseContextMenu {

  offset = { x: 0, y: 0, z: 0 };
  /** @type {string | undefined} */
  speech = undefined;

  updateOffset() {
    const npc = this.w.n[this.key];

    switch (npc.s.act) {
      case 'Idle':
      case 'Run':
      case 'Walk':
        this.offset.y = 2;
        break;
      case 'Lie':
        this.offset.y = 0.9;
        break;
      case 'Sit':
        this.offset.y = 1.7;
        break;
    }
  }
}

/**
 * @typedef {(
 *   | DefaultContextMenu
 *   | NpcSpeechBubble
 * )} ContextMenuType
 */

/**
 * Used by "default" and "@{npcKey}"
 * @typedef ContextMenuUi
 * @property {{ k: string; v: string; length: number; }[]} kvs
 * Key values e.g. of last clicked meta
 * @property {NPC.ContextMenuLink[]} links
 * @property {string} [speech]
 */

function noop() {};
