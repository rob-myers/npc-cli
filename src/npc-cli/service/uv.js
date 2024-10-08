import * as THREE from "three";

import { Rect } from "../geom";
import { keys } from "./generic";
import { getGeometryUvs } from "./three";

/**
 * For `'cuboid-man'` | `'cuboid-pet'` ≤ `NPC.ClassKey`
 * 
 * Their Blender Mesh has 32 vertices,
 * whereas their GLTF Mesh has 64 vertices:
 * 
 * - (3 * 8) + (3 * 8) + (4 * 4) = 64
 *   i.e. head (cuboid), body (cuboid), 4 quads
 * - head < body < shadow quad < selector quad < icon quad < label quad
 * - concerning face:
 *   - cuboid vertices duped 3 times (adjacently) due to uv map
 *   - via vertex normals, face corresponds to 1st copy (4 times)
 * 
 * ∴ label quad vertex ids: 60, 61, 62, 63
 * ∴ icon quad vertex ids: 56, 57, 58, 59
 * ∴ face quad vertex ids: 3 * 0, 3 * 1, 3 * 4, 3 * 5 
 */
class CuboidManUvService {

  toQuadMetas = /** @type {Record<'cuboid-man' | 'cuboid-pet', CuboidManQuadMetas>} */ ({});

  /**
   * @param {Geom.VectJson[]} uvDeltas 
   * @param {Rect} uvRect 
   * @returns {THREE.Vector2[]}
   */
  instantiateUvDeltas(uvDeltas, uvRect) {
    const { center, width, height } = uvRect;
    // 🔔 Array of Geom.VectJSON or [number, number] throws error
    return uvDeltas.map(p => new THREE.Vector2(
      center.x + (width * p.x),
      center.y + (height * p.y),
    ));
  }

  /**
   * @param {'cuboid-man' | 'cuboid-pet'} npcClassKey
   * @param {THREE.SkinnedMesh} skinnedMesh
   * @returns {CuboidManQuadMetas};
   */
  getQuadMetas(npcClassKey, skinnedMesh) {
    return this.toQuadMetas[npcClassKey] ??= this.storeUvOffsets(npcClassKey, skinnedMesh);
  }

  /**
   * Set value of `toQuadMetas[npcClassKey]` (never changes).
   * @private
   * @param {'cuboid-man' | 'cuboid-pet'} npcClassKey 
   * @param {THREE.SkinnedMesh} skinnedMesh 
   * @returns {CuboidManQuadMetas};
   */
  storeUvOffsets(npcClassKey, skinnedMesh) {
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
        uvs: this.instantiateUvDeltas(quad.uvDeltas, quad.uvRect),
        // ℹ️ inferred from Blender model
        // ℹ️ 'face' and 'icon' have same dimension
        dim: quadKey === 'label' ? [0.75, 0.375] : [0.4, 0.4],
      };
    }

    return this.toQuadMetas[npcClassKey] = toQuadMeta;
  }

}

export const cmUvService = new CuboidManUvService();

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
const emptyQuadMeta = { vertexIds: [], uvRect: new Rect(), uvDeltas: [], default: /** @type {UvQuadInstance} */ ({}) };
