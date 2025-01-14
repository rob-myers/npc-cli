/**
 * 🔔 Avoid `foo = (...bar) => baz` because incompatible with our approach to class HMR.
 */
export class SpeechBubbleApi {

  baseScale = /** @type {undefined | number} */ (undefined);
  /** For violating React.memo */
  epochMs = 0;
  
  position = /** @type {[number, number, number]} */ ([0, 0, 0]);
  tracked = /** @type {undefined | import('three').Object3D} */ (undefined);
  offset = { x: 0, y: 0, z: 0 };
  
  open = false;

  /** @type {import('../components/Html3d').State} */
  html3d = /** @type {*} */ (null);

  /**
   * @param {string} key
   * @param {import('./World').State} w
   */
  constructor(key, w) {
    /** @type {string} */ this.key = key;
    /** @type {import('./World').State} */ this.w = w;
  }

  /** @type {string | undefined} */
  speech = undefined;

  dispose() {
    this.tracked = undefined;
    this.update = noop;
    // @ts-ignore
    this.w = null;
    this.html3dRef(null);
  }

  /** @param {null | import('../components/Html3d').State} html3d */
  html3dRef(html3d) {
    return html3d !== null
      ? this.html3d = html3d // @ts-ignore
      : delete this.html3d;
  }

  /**
   * @param {import('three').Object3D} [input] 
   */
  setTracked(input) {
    this.tracked = input;
  }

  update = noop

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

function noop() {};
