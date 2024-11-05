import * as THREE from 'three';
import { getContext2d } from './dom';

/**
 * Based on:
 * https://discourse.threejs.org/t/how-can-i-color-the-plane-with-different-colors-as-squares-in-the-same-face/53418/8
 */
export class TexArray {
  
  /** @type {TexArrayOpts} */
  opts;
  /** @type {CanvasRenderingContext2D} */
  ct;
  /** @type {THREE.DataArrayTexture} */
  tex;

  /**
   * @param {TexArrayOpts} opts
   */
  constructor(opts) {
    if (opts.numTextures === 0) {
      throw Error(`${'TexArray'}: numTextures cannot be 0`);
    }

    this.opts = opts;
    this.ct = getContext2d(opts.ctKey);
    this.ct.canvas.width = opts.width;
    this.ct.canvas.height = opts.height;
    
    const data = new Uint8Array(opts.numTextures * 4 * opts.width * opts.height);

    const tex = new THREE.DataArrayTexture(data, opts.width, opts.height, opts.numTextures);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    this.tex = tex;

    // const firstTex = textures[0].tex;
    // tex.anisotropy = firstTex.anisotropy;
    // tex.minFilter = firstTex.minFilter;
    // tex.magFilter = firstTex.magFilter;
    // tex.wrapS = firstTex.wrapS;
    // tex.wrapT = firstTex.wrapT;
    // tex.encoding = THREE.sRGBEncoding;
    // tex.generateMipmaps = true;
    // tex.needsUpdate = true;
  }

  dispose() {
    // We don't `this.ct.canvas.{width,height} = 0`,
    // because context is cached under `opts.ctKey`.
    this.tex.dispose();
  }

  /**
   * @param {Omit<TexArrayOpts, 'ctKey'>} opts
   */
  resize(opts) {
    Object.assign(this.opts, opts);

    this.ct.canvas.width = opts.width;
    this.ct.canvas.height = opts.height;
    
    this.tex.dispose();
    const data = new Uint8Array(opts.numTextures * 4 * opts.width * opts.height);

    const tex = new THREE.DataArrayTexture(data, opts.width, opts.height, opts.numTextures);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    this.tex = tex;
  }

  update() {
    this.tex.needsUpdate = true;
  }

  /**
   * @param {number} index
   */
  updateIndex(index) {
    const imageData = this.ct.getImageData(0, 0, this.opts.width, this.opts.height);
    const offset = index * (4 * this.opts.width * this.opts.height);
    this.tex.image.data.set(imageData.data, offset);
    // this.tex.needsUpdate = true;
  }
}

/**
 * @typedef {{ tex: THREE.CanvasTexture; ct: CanvasRenderingContext2D }} TextureItem
 */

/**
 * @typedef TexArrayOpts
 * @property {number} opts.numTextures
 * @property {number} opts.width
 * @property {number} opts.height
 * @property {string} opts.ctKey key for cached canvas context
 */

export const emptyTexArray = new TexArray({ ctKey: 'empty', width: 0, height: 0, numTextures: 1 });
