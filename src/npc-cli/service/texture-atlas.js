import * as THREE from 'three';

/**
 * Based on:
 * https://discourse.threejs.org/t/how-can-i-color-the-plane-with-different-colors-as-squares-in-the-same-face/53418/8
 */
export class TextureAtlas {
  
  arrayTex = /** @type {THREE.DataArrayTexture} */ ({});
  height = 0;
  textures = /** @type {TextureItem[]} */ ([]);
  width = 0;

  /**
   * Call `this.update()` after construction.
   * @param {TextureItem[]} textures
   */
  constructor(textures) {
    if (textures.length === 0) {
      throw Error(`${'TextureAtlas'}: textures.length cannot be 0`);
    }
    
    // assume all same width, height e.g. 1024 * 1024
    const { width, height } = textures[0].ct.canvas;
    const data = new Uint8Array(textures.length * 4 *  width * height);

    // for (const [index, { ct }] of textures.entries()) {
    //   const imageData = ct.getImageData(0, 0, ct.canvas.width, ct.canvas.height);
    //   const offset = index * (4 * width * height);
    //   data.set(imageData.data, offset);
    // }

    const arrayTex = new THREE.DataArrayTexture(data, width, height, textures.length);
    arrayTex.format = THREE.RGBAFormat;
    arrayTex.type = THREE.UnsignedByteType;
    arrayTex.minFilter = THREE.LinearMipMapLinearFilter;
    arrayTex.magFilter = THREE.LinearFilter;
    arrayTex.wrapS = THREE.RepeatWrapping;
    arrayTex.wrapT = THREE.RepeatWrapping;
    arrayTex.generateMipmaps = true;
    // arrayTex.encoding = THREE.sRGBEncoding;
    // arrayTex.needsUpdate = true;

    this.arrayTex = arrayTex;
    this.height = height;
    this.textures = textures;
    this.width = width;

  }

  dispose(disposeTextures = false) {
    if (disposeTextures) {
      this.textures.forEach(({ tex }) => tex.dispose());
    }
    this.arrayTex.dispose();
  }

  /**
   * Assume width/height/textures.length stays the same.
   */
  update() {
    for (const [index, { ct }] of this.textures.entries()) {
      const imageData = ct.getImageData(0, 0, ct.canvas.width, ct.canvas.height);
      const offset = index * (4 * this.width * this.height);
      this.arrayTex.image.data.set(imageData.data, offset);
    }
    this.arrayTex.needsUpdate = true;
  }
}

/**
 * @typedef {{ tex: THREE.CanvasTexture; ct: CanvasRenderingContext2D }} TextureItem
 */
