import * as THREE from "three";

/** Unit quad extending from origin to (1, 0, 1) */
export const quadGeometryXZ = new THREE.BufferGeometry();
// prettier-ignore
const xzVertices = new Float32Array([0, 0, 0,  1, 0, 1,  1, 0, 0,  0, 0, 1]);
const xzUvs = new Float32Array([0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0]);
const xzIndices = [0, 1, 2, 0, 1, 3];
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

/**
 * @param {Geom.Poly[]} polys
 * @returns {THREE.BufferGeometry}
 */
export function polysToXZGeometry(polys) {
  const geometry = new THREE.BufferGeometry();
  const vertices = /** @type {number[]} */ ([]);
  const indices = /** @type {number[]} */ ([]);
  const uvs = /** @type {number[]} */ ([]);
  let offset = 0;

  for (const poly of polys) {
    const { tris, vs } = poly.fastTriangulate();
    const { rect } = poly;
    vertices.push(...vs.flatMap(({ x, y }) => [x, 0, y]));
    indices.push(...tris.flatMap((x) => x).map((x) => x + offset));
    uvs.push(...vs.flatMap(({ x, y }) => [(x - rect.x) / rect.width, (y - rect.y) / rect.height]));
    offset += vs.length;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));

  return geometry;
}
