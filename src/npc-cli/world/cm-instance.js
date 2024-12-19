import * as THREE from "three";
import { stringify as javascriptStringify } from 'javascript-stringify';
import { objectScale } from "../components/Html3d";

export class CMInstance {

  /** @type {import('../components/Html3d').State} */
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
    // speech: undefined,
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

  /** @param {boolean} [force] */
  hide(force) {
    if (this.pinned === true && force !== true) {
      return;
    }
    this.open = false;
    this.update();
  }

  /** @param {null | import('../components/Html3d').State} html3d */
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

  /** @param {number} opacity  */
  setOpacity(opacity) {
    this.html3d.rootDiv.style.opacity = `${opacity}`;
  }
  
  /** @param {string} speech  */
  setSpeech(speech) {
    this.ui.speech = speech;
    this.update();
  }

  /**
   * @param {THREE.Object3D} [input] 
   */
  setTracked(input) {
    this.tracked = input;

    if (input !== undefined) {
      // this.baseScale = input.position.distanceTo(this.w.r3f.camera.position);
      this.baseScale = 10;
    }
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
 * Used by "default" and "@{npcKey}"
 * @typedef ContextMenuUi
 * @property {{ k: string; v: string; length: number; }[]} kvs
 * Key values e.g. of last clicked meta
 * @property {NPC.ContextMenuLink[]} links
 * @property {string} [speech]
 */

const tmpVector1 = new THREE.Vector3();
function noop() {};
