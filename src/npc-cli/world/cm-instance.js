import * as THREE from "three";
import { stringify as javascriptStringify } from 'javascript-stringify';
import { objectScale } from "../components/Html3d";
import { warn } from "../service/generic";

/**
 * 🔔 Avoid `foo = (...bar) => baz` because incompatible with our approach to HMR.
 */
export class CMInstance {

  baseScale = /** @type {undefined | number} */ (undefined);
  /** For violating React.memo */
  epochMs = 0;
  
  position = /** @type {[number, number, number]} */ ([0, 0, 0]);
  tracked = /** @type {undefined | THREE.Object3D} */ (undefined);
  
  docked = false;
  open = false;
  pinned = false;
  scaled = false;
  showKvs = false;

  //#region default context menu
  /** @type {import('../components/Html3d').State} */
  html3d = /** @type {*} */ (null);
  /** @type {import('../components/PopUp').State} */
  popUp = /** @type {*} */ (null);

  /** @type {ContextMenuUi['kvs']} */
  kvs = [];
  /** @type {ContextMenuUi['links']} */
  links = [];
  match = /** @type {{ [matcherKey: string]: NPC.ContextMenuMatcher}} */ ({});
  meta = /** @type {Geom.Meta} */ ({});
  npcKey = /** @type {undefined | string} */ (undefined);
  selectNpcOpts = /** @type {any[]} */ ([]); // 🚧
  //#endregion

  /** @type {ContextMenuUi['speech']} */
  speech = undefined;

  /**
   * @param {string} key
   * @param {import('./World').State} w
   * @param {Partial<Pick<CMInstance, 'showKvs' | 'npcKey' | 'pinned'>>} opts
   */
  constructor(key, w, opts) {
    /** @type {string} */ this.key = key;
    /** @type {import('./World').State} */ this.w = w;

    const savedOpts = w.c.savedOpts[key] ?? {};
    this.pinned = opts.pinned ?? savedOpts.pinned ?? w.smallViewport;
    this.scaled = false,
    this.showKvs = opts.showKvs ?? savedOpts.showKvs ?? false,
    this.npcKey = opts.npcKey;
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

    this.w.c.saveOpts();
    this.update();
  }

  /** @param {null | import('../components/PopUp').State} popUp */
  popUpRef(popUp) {
    return popUp !== null
      ? this.popUp = popUp // @ts-ignore
      : delete this.popUp;
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

  /** @param {number} opacity  */
  setOpacity(opacity) {
    this.html3d.rootDiv.style.opacity = `${opacity}`;
  }

  /**
   * @param {THREE.Object3D} [input] 
   */
  setTracked(input) {
    this.tracked = input;
  }

  /** @param {NPC.ContextMenuContextDef} [ct] */
  show(ct) {
    if (ct !== undefined) {
      this.setContext(ct);
    }
    this.open = true;
    this.update();
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

/**
 * Used by "default" and "@{npcKey}"
 * @typedef ContextMenuUi
 * @property {{ k: string; v: string; length: number; }[]} kvs
 * Key values e.g. of last clicked meta
 * @property {NPC.ContextMenuLink[]} links
 * @property {string} [speech]
 */

const tmpVector1 = new THREE.Vector3();
function noop() {};
