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
      // ℹ️ w.npc.label.tex ~ texture id 1
      (this.toTexId[npcClassKey] ??= {})[npcClassKey] = 0;

      // shader needs vertexId attribute
      const numVertices = mesh.geometry.getAttribute('position').count;
      const vertexIds = [...Array(numVertices)].map((_,i) => i);
      mesh.geometry.setAttribute('vertexId', new THREE.BufferAttribute(new Int32Array(vertexIds), 1));
    }
  }

  /**
   * 'face' or 'icon' ('label' handled elsewhere)
   * @param {NPC.NPC} npc
   * @param {ChangeUvQuadOpts} [opts]
   */
  changeUvQuad(npc, opts = {}) {
    const quad = /** @type {CuboidManQuads} */ (npc.s.quad);
    const quadMeta = this.toQuadMetas[npc.def.classKey];
    const { uvMap } = npc.w.geomorphs.sheet.skins;

    for (const quadKey of /** @type {const} */ (['face', 'icon'])) {
      if (opts[quadKey]) {
        const [uvMapKey, uvKey] = opts[quadKey];
        const srcRect = uvMap[uvMapKey]?.[uvKey];
        if (!srcRect) {
          throw Error(`${npc.key}: ${quadKey}: [uvMap, uvKey] not found: ${JSON.stringify(opts[quadKey])}`)
        }

        // 🔔 srcRect is already in [0, 1]x[0, 1]
        const srcUvRect = Rect.fromJson(srcRect);
        this.instantiateUvDeltas(quad[quadKey], quadMeta[quadKey].uvDeltas, srcUvRect);
        quad[quadKey].texId = this.toTexId[npc.def.classKey][uvMapKey]; // e.g. 0

      } else if (opts[quadKey] === null) {// Reset
        quad[quadKey] = this.cloneUvQuadInstance(quadMeta[quadKey].default);
      }
    }
  }

  /**
   * @param {UvQuadInstance} uvQuadInst 
   * @returns {UvQuadInstance}
   */
  cloneUvQuadInstance(uvQuadInst) {
    return {// clone quadMeta.label.default
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
    return {// clone quadMeta.label.default
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
      quad.uvDeltas = quadUvs.map(p => ({
        x: p.x === uvRect.x ? -0.5 : 0.5,
        y: p.y === uvRect.y ? -0.5 : 0.5,
      }));
      quad.default = {
        texId: 0, // base skin
        uvs: [...Array(4)].map(_ => new THREE.Vector2()),
        // Dimensions come from Blender Model
        dim: quadKey === 'label' ? [0.75, 0.375] : [0.4, 0.4],
      };
      this.instantiateUvDeltas(quad.default, quad.uvDeltas, quad.uvRect);
    }

    return toQuadMeta;
  }

  /**
   * @param {UvQuadInstance} quad 
   * @param {Geom.VectJson[]} uvDeltas 
   * @param {Rect} uvRect 
   */
  instantiateUvDeltas(quad, uvDeltas, uvRect) {
    const { center, width, height } = uvRect;
    quad.uvs.forEach((uv, i) => uv.set(
      center.x + (width * uvDeltas[i].x),
      center.y + (height * uvDeltas[i].y),
    ));
  }

  /**
   * @param {NPC.NPC} npc
   */
  updateLabelQuad(npc) {
    const label = npc.s.label;
    const quad = /** @type {CuboidManQuads} */ (npc.s.quad);
    const quadMeta = this.toQuadMetas[npc.def.classKey];
    
    if (label === null) {// reset
      this.copyUvQuadInstance(quadMeta.label.default, quad.label);
      return;
    }
    
    const { label: npcLabel } = npc.w.npc;
    const srcRect = npcLabel.lookup[label];

    if (!srcRect) {// reset it
      // throw Error(`${npc.key}: label not found: ${JSON.stringify(label)}`)
      warn(`${npc.key}: label not found: ${JSON.stringify(label)}`);
      this.copyUvQuadInstance(quadMeta.label.default, quad.label);
      return;
    }

    const srcUvRect = Rect.fromJson(srcRect).scale(1 / npcLabel.tex.image.width, 1 / npcLabel.tex.image.height);
    const npcScale = npcClassToMeta[npc.def.classKey].scale;

    this.instantiateUvDeltas(quad.label, quadMeta.label.uvDeltas, srcUvRect);
    quad.label.texId = 1; // 🔔 npc.label.tex
    quad.label.dim = [0.006 * npcScale * srcRect.width, 0.006 * npcScale * srcRect.height];
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
