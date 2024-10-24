import * as THREE from "three";

import { Rect } from "../geom";
import { keys, warn } from "./generic";
import { buildObjectLookup, getGeometryUvs } from "./three";
import { npcClassKeys, npcClassToMeta } from "./const";

/**
 * For `'cuboid-man'` or `'cuboid-pet'` i.e. `NPC.ClassKey`.
 * - ℹ️ additional models may need separate uv service
 * 
 * Their Blender Mesh has 32 vertices, whereas
 * their GLTF Mesh has 64 vertices:
 * 
 * - (3 * 8) + (3 * 8) + (4 * 4) = 64
 *   i.e. head (cuboid), body (cuboid), 4 quads
 * - head < body < shadow quad < selector quad < icon quad < label quad
 * - cuboid vertices duped 3 times (adjacently) due to uv map
 * 
 * In particular:
 * - face quad vertex ids: 3 * 0, 3 * 1, 3 * 4, 3 * 5 
 * - icon quad vertex ids: 56, 57, 58, 59
 * - label quad vertex ids: 60, 61, 62, 63
 */
class CuboidManUvService {

  toQuadMetas = /** @type {Record<NPC.ClassKey, CuboidManQuadMetas>} */ ({});

  toTexId = /** @type {Record<NPC.ClassKey, { [uvMapKey: string]: number }>} */ ({});
  
  /**
   * @param {Record<NPC.ClassKey, import("three-stdlib").GLTF>} gltf 
   */
  initialize(gltf) {
    for (const npcClassKey of npcClassKeys) {
      const meta = npcClassToMeta[npcClassKey];
      const { nodes } = buildObjectLookup(gltf[npcClassKey].scene);
      const mesh = /** @type {THREE.SkinnedMesh} */ (nodes[meta.meshName]);
      
      // each npc class has a corresponding constant "quad meta"
      this.toQuadMetas[npcClassKey] = this.initComputeQuadMetas(mesh);

      // each npc class is also a uvMapKey, fed as 0th texture
      // 🚧 setup alt texture when available
      (this.toTexId[npcClassKey] ??= {})[npcClassKey] = 0;

      // shader needs vertexId attribute
      const numVertices = mesh.geometry.getAttribute('position').count;
      const vertexIds = [...Array(numVertices)].map((_,i) => i);
      mesh.geometry.setAttribute('vertexId', new THREE.BufferAttribute(new Int32Array(vertexIds), 1));
    }
  }

  /**
   * @param {UvQuadInstance} uvQuadInst 
   * @returns {UvQuadInstance}
   */
  cloneUvQuadInstance(uvQuadInst) {
    return {
      texId: uvQuadInst.texId,
      dim: /** @type {[number, number]} */ (uvQuadInst.dim.slice()),
      uvs: uvQuadInst.uvs.map(v => v.clone()), // THREE.Vector2
    };
  }

  /**
   * @param {UvQuadInstance} src 
   * @param {UvQuadInstance} dst 
   * @returns {UvQuadInstance}
   */
  copyUvQuadInstance(src, dst) {
    dst.texId = src.texId;
    // 🔔 mutating dim caused issue on null label
    dst.dim = [src.dim[0], src.dim[1]];
    dst.uvs.forEach((v, i) => v.copy(src.uvs[i]));
    return dst;
  }

  /**
   * @param {NPC.ClassKey} npcClassKey 
   * @returns {CuboidManQuads}
   */
  getDefaultUvQuads(npcClassKey) {
    const quadMeta = this.toQuadMetas[npcClassKey]; // Assume exists
    return {
      label: this.cloneUvQuadInstance(quadMeta.label.default),
      face: this.cloneUvQuadInstance(quadMeta.face.default),
      icon: this.cloneUvQuadInstance(quadMeta.icon.default),
    };
  }

  /**
   * We only need to compute this once for each npc class.
   * @private
   * @param {THREE.SkinnedMesh} skinnedMesh 
   * @returns {CuboidManQuadMetas};
   */
  initComputeQuadMetas(skinnedMesh) {
    const uvs = getGeometryUvs(skinnedMesh.geometry);

    /** @type {CuboidManQuadMetas} */
    const toQuadMeta = {
      face: { ...emptyQuadMeta, vertexIds: [0, 3, 3 * 4, 3 * 5], },
      icon: { ...emptyQuadMeta, vertexIds: [56, 57, 58, 59], },
      label: { ...emptyQuadMeta, vertexIds: [60, 61, 62, 63], },
    };

    for (const quadKey of keys(toQuadMeta)) {
      const quad = toQuadMeta[quadKey];
      const quadUvs = quad.vertexIds.map(vId => uvs[vId]);
      const uvRect = Rect.fromPoints(...quadUvs).precision(6);

      quad.uvRect = uvRect;
      quad.uvDeltas = quadUvs.map(p => ({ x: p.x === uvRect.x ? -0.5 : 0.5, y: p.y === uvRect.y ? -0.5 : 0.5 }));

      if (quadKey === 'label') {// initially empty
        quad.default = { texId: 1, uvs: [...Array(4)].map(_ => new THREE.Vector2()), dim: [0, 0] };
        // quad.default = { texId: 0, uvs: [...Array(4)].map(_ => new THREE.Vector2()), dim: [0.75, 0.375] };
        // this.instantiateUvDeltas(quad.default, quad.uvDeltas, quad.uvRect);
      } else {// base skin; 0.4 * 0.4 from Blender model
        quad.default = { texId: 0, uvs: [...Array(4)].map(_ => new THREE.Vector2()), dim: [0.4, 0.4] };
        this.instantiateUvDeltas(quad.default, quad.uvDeltas, quad.uvRect);
      }
    }

    return toQuadMeta;
  }

  /**
   * @param {UvQuadInstance} quad 
   * @param {Geom.VectJson[]} uvDeltas 
   * @param {Rect} uvRect 
   */
  instantiateUvDeltas(quad, uvDeltas, uvRect) {
    const { center: c, width, height } = uvRect;
    quad.uvs.forEach((uv, i) => uv.set(c.x + (width * uvDeltas[i].x), c.y + (height * uvDeltas[i].y)));
  }

  /**
   * @param {NPC.NPC} npc
   */
  updateFaceQuad(npc) {
    const { s: { faceId }, m: { quad } } = npc;
    const quadMeta = this.toQuadMetas[npc.def.classKey];
    
    if (faceId === null) {// Reset
      this.copyUvQuadInstance(quadMeta.face.default, quad.face);
      return;
    }

    const { uvMap } = npc.w.geomorphs.sheet.skins;
    const srcRect = uvMap[faceId.uvMapKey]?.[faceId.uvQuadKey];
    if (!srcRect) {
      throw Error(`${npc.key}: face: uvMapKey, uvQuadKey not found: ${JSON.stringify(faceId)}`)
    }

    // 🔔 srcRect is already in [0, 1]x[0, 1]
    const srcUvRect = Rect.fromJson(srcRect);
    this.instantiateUvDeltas(quad.face, quadMeta.face.uvDeltas, srcUvRect);
    // 🔔 currently always `0` because we lack other textures
    quad.face.texId = this.toTexId[npc.def.classKey][faceId.uvMapKey];
  }

  /**
   * @param {NPC.NPC} npc
   */
  updateIconQuad(npc) {
    const { s: { iconId }, m: { quad } } = npc;
    const quadMeta = this.toQuadMetas[npc.def.classKey];
    
    if (iconId === null) {// Reset
      this.copyUvQuadInstance(quadMeta.icon.default, quad.icon);
      return;
    }

    const { uvMap } = npc.w.geomorphs.sheet.skins;
    const srcRect = uvMap[iconId.uvMapKey]?.[iconId.uvQuadKey];
    if (!srcRect) {
      throw Error(`${npc.key}: icon: uvMapKey, uvQuadKey not found: ${JSON.stringify(iconId)}`)
    }

    // 🔔 srcRect is already in [0, 1]x[0, 1]
    const srcUvRect = Rect.fromJson(srcRect);
    this.instantiateUvDeltas(quad.icon, quadMeta.icon.uvDeltas, srcUvRect);
    // 🔔 currently always `0` because we lack other textures
    quad.icon.texId = this.toTexId[npc.def.classKey][iconId.uvMapKey];
  }

  /**
   * @param {NPC.NPC} npc
   */
  updateLabelQuad(npc) {
    const { s: { label }, m: { quad } } = npc;
    const quadMeta = this.toQuadMetas[npc.def.classKey];
    
    if (label === null) {// reset
      this.copyUvQuadInstance(quadMeta.label.default, quad.label);
      return;
    }
    
    const npcLabel = npc.w.npc.label;
    const srcRect = npcLabel.lookup[label];

    if (!srcRect) {// reset it
      warn(`${npc.key}: label not found: ${JSON.stringify(label)}`);
      this.copyUvQuadInstance(quadMeta.label.default, quad.label);
      return;
    }

    const srcUvRect = Rect.fromJson(srcRect).scale(1 / npcLabel.tex.image.width, 1 / npcLabel.tex.image.height);
    const npcScale = npcClassToMeta[npc.def.classKey].scale;

    this.instantiateUvDeltas(quad.label, quadMeta.label.uvDeltas, srcUvRect);
    quad.label.texId = 1; // 🔔 npc.label.tex
    quad.label.dim = /** @type {[number, number]} */ ([0.006 * npcScale * srcRect.width, 0.006 * npcScale * srcRect.height]);
  }

}

export const cmUvService = new CuboidManUvService();

/**
 * @typedef {Record<CuboidManQuadKeys, UvQuadInstance>} CuboidManQuads
 */

/**
 * @typedef {Record<CuboidManQuadKeys, UvQuadMeta>} CuboidManQuadMetas
 */

/**
 * @typedef {'face' | 'icon' | 'label'} CuboidManQuadKeys
 */

/**
 * @typedef {{
 *   vertexIds: number[];
 *   uvRect: Rect;
 *   uvDeltas: Geom.VectJson[];
 *   default: UvQuadInstance;
 * }} UvQuadMeta
 */

/**
 * @typedef {{
 *   texId: number;
 *   uvs: THREE.Vector2[];
 *   dim: [number, number];
 * }} UvQuadInstance
 */

/** @type {UvQuadMeta} */
const emptyQuadMeta = {
  vertexIds: [],
  uvRect: new Rect(),
  uvDeltas: [],
  default: /** @type {UvQuadInstance} */ ({}),
};

/**
 * @typedef {{ face?: [string, string]; icon?: [string, string]; }} ChangeUvQuadOpts
 * Format `[uvMapKey, uvKey]` e.g. `["cuboid-man", "front-face-angry"]
 */
