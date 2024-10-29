import * as THREE from 'three';

/**
 * Based on:
 * https://discourse.threejs.org/t/how-can-i-color-the-plane-with-different-colors-as-squares-in-the-same-face/53418/8
 */
export class TextureAtlas {
  
  /** @type {Record<string, KeyedAtlas>} */
  textures = {};

  /**
   * @param {string} atlasKey 
   * @param {TextureItem[]} textures
   */
  add(atlasKey, textures) {
    if (textures.length === 0) {
      throw Error(`${'TextureAtlas.add'}: textures.length cannot be 0`);
    }
    
    // assume all same width, height e.g. 1024 * 1024
    const { width, height } = textures[0].ct.canvas;
    const data = new Uint8Array(textures.length * 4 *  width * height);

    for (const [index, { ct }] of textures.entries()) {
      const imageData = ct.getImageData(0, 0, ct.canvas.width, ct.canvas.height);
      const offset = index * (4 * width * height);
      data.set(imageData.data, offset);
    }

    const arrayTex = new THREE.DataArrayTexture(data, width, height, textures.length);
    arrayTex.format = THREE.RGBAFormat;
    arrayTex.type = THREE.UnsignedByteType;
    arrayTex.minFilter = THREE.LinearMipMapLinearFilter;
    arrayTex.magFilter = THREE.LinearFilter;
    arrayTex.wrapS = THREE.RepeatWrapping;
    arrayTex.wrapT = THREE.RepeatWrapping;
    arrayTex.generateMipmaps = true;
    // arrayTex.encoding = THREE.sRGBEncoding;
    arrayTex.needsUpdate = true;

    this.textures[atlasKey] = { textures, arrayTex, width, height };
  }
  
  /**
   * @param {string} atlasKey 
   */
  remove(atlasKey, disposeTextures = false) {
    const { arrayTex, textures } = this.textures[atlasKey];
    if (disposeTextures) {
      textures.forEach(({ tex }) => tex.dispose());
    }
    arrayTex.dispose();
    delete this.textures[atlasKey];
  }

  /**
   * Assume width/height/textures.length stays the same.
   * @param {string} atlasKey 
   */
  update(atlasKey) {
    const prev = this.textures[atlasKey];
    if (!prev) {
      throw Error(`${'TextureAtlas.update'}: ${atlasKey}: does not exist`);
    }

    for (const [index, { ct }] of prev.textures.entries()) {
      const imageData = ct.getImageData(0, 0, ct.canvas.width, ct.canvas.height);
      const offset = index * (4 * prev.width * prev.height);
      prev.arrayTex.image.data.set(imageData.data, offset);
    }

    prev.arrayTex.needsUpdate = true;
  }
}


/**
 * @typedef {object} KeyedAtlas
 * @property {TextureItem[]} textures
 * @property {THREE.DataArrayTexture} arrayTex
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {{ tex: THREE.CanvasTexture; ct: CanvasRenderingContext2D }} TextureItem
 */
