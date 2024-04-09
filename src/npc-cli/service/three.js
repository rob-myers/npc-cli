import * as THREE from "three";
import { Vect } from "../geom";

/** Unit quad extending from origin to (1, 0, 1) */
export const quadGeometryXZ = new THREE.BufferGeometry();
// prettier-ignore
const xzVertices = new Float32Array([0, 0, 0,  1, 0, 1,  1, 0, 0,  0, 0, 1]);
const xzUvs = new Float32Array([0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0]);
const xzIndices = [0, 1, 2, 0, 3, 1];
quadGeometryXZ.setAttribute("position", new THREE.BufferAttribute(xzVertices.slice(), 3));
quadGeometryXZ.setAttribute("uv", new THREE.BufferAttribute(xzUvs.slice(), 2));
quadGeometryXZ.setIndex(xzIndices.slice());

/** Unit quad extending from origin to (1, 1, 0) */
export const quadGeometryXY = new THREE.BufferGeometry();
// prettier-ignore
const xyVertices = new Float32Array([0, 0, 0,  0, 1, 0,  1, 1, 0,  1, 0, 0]);
const xyUvs = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);
const xyIndices = [2, 1, 0, 0, 3, 2];
quadGeometryXY.setAttribute("position", new THREE.BufferAttribute(xyVertices.slice(), 3));
quadGeometryXY.setAttribute("uv", new THREE.BufferAttribute(xyUvs.slice(), 2));
quadGeometryXY.setIndex(xyIndices.slice());

export const tmpBufferGeom1 = new THREE.BufferGeometry();

/**
 * @param {Geom.Poly[]} polys
 * @param {Object} opts
 * @param {boolean} [opts.reverse] e.g. fix normals for recast/detour
 * @returns {THREE.BufferGeometry}
 */
export function polysToXZGeometry(polys, { reverse = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  const { vertices, indices, uvs } = polysToAttribs(polys);
  if (reverse) {
    indices.reverse();
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}

/**
 * @param {Geom.Poly[]} polys
 */
export function polysToAttribs(polys) {
  const vertices = /** @type {number[]} */ ([]);
  const indices = /** @type {number[]} */ ([]);
  const uvs = /** @type {number[]} */ ([]);
  let offset = 0;

  for (const poly of polys) {
    const { tris, vs } = poly.cleanFinalReps().qualityTriangulate();
    const rect = poly.rect;
    vertices.push(...vs.flatMap(({ x, y }) => [x, 0, y]));
    indices.push(...tris.flatMap((x) => x).map((x) => x + offset));
    uvs.push(...vs.flatMap(({ x, y }) => [(x - rect.x) / rect.width, (y - rect.y) / rect.height]));
    offset += vs.length;
  }

  return {
    vertices,
    indices,
    uvs,
  };
}

export const wireFrameMaterial = new THREE.MeshStandardMaterial({
  wireframe: true,
  color: "green",
});

export const tmpVectThree1 = new THREE.Vector3();
export const tmpMesh1 = new THREE.Mesh();
export const tmpBox1 = new THREE.Box3();
