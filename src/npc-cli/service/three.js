/**
 * Also used by web worker.
 */
import * as THREE from "three";
import { LineMaterial } from "three-stdlib";
import { Rect, Vect } from "../geom";

/** Unit quad extending from (0, 0, 0) to (1, 0, 1) */
const quadGeometryXZ = new THREE.BufferGeometry();
const xzVertices = new Float32Array([0,0,0, 1,0,0, 1,0,1, 0,0,1]);
const xzUvs = new Float32Array([0,0, 1,0, 1,1, 0,1]);
const xzIndices = [2, 1, 0, 0, 3, 2];
const xzNormals = [0,1,0, 0,1,0, 0,1,0, 0,1,0]; // For shadows
quadGeometryXZ.setAttribute("position", new THREE.BufferAttribute(xzVertices.slice(), 3));
quadGeometryXZ.setAttribute("uv", new THREE.BufferAttribute(xzUvs.slice(), 2));
quadGeometryXZ.setAttribute( 'normal', new THREE.Float32BufferAttribute( xzNormals.slice(), 3 ) );
quadGeometryXZ.setIndex(xzIndices.slice());

/** Cache to avoid re-creation on HMR */
const quadLookup = /** @type {Record<string, THREE.BufferGeometry>} */ ({});

/**
 * Clone to avoid overwriting attributes used by custom shaders
 * @param {string} key
 */
export function getQuadGeometryXZ(key) {
  return quadLookup[key] ??= quadGeometryXZ.clone();
}

// 🚧 repeat above for XY quad

/** Unit quad extending from (0, 0, 0) to (1, 1, 0) */
export const quadGeometryXY = new THREE.BufferGeometry();
const xyVertices = new Float32Array([0,0,0, 0,1,0, 1,1,0, 1,0,0]);
const xyUvs = new Float32Array([0,1, 0,0, 1,0, 1,1]); // flipY false, Origin at topLeft of image
const xyIndices = [2, 1, 0, 0, 3, 2];
const xyNormals = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
quadGeometryXY.setAttribute("position", new THREE.BufferAttribute(xyVertices.slice(), 3));
quadGeometryXY.setAttribute("uv", new THREE.BufferAttribute(xyUvs.slice(), 2));
quadGeometryXZ.setAttribute( 'normal', new THREE.Float32BufferAttribute( xyNormals.slice(), 3 ) );
quadGeometryXY.setIndex(xyIndices.slice());

export const tmpBufferGeom1 = new THREE.BufferGeometry();

/**
 * @param {Geom.Poly[]} polys
 * @param {Object} opts
 * @param {boolean} [opts.reverse]
 * @returns {THREE.BufferGeometry}
 */
export function polysToXZGeometry(polys, { reverse = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  const { vertices, indices, uvs } = polysToXZAttribs(polys);
  reverse && indices.reverse();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}

/**
 * @param {Geom.Triangulation} decomp
 * @param {Object} opts
 * @param {boolean} [opts.reverse]
 * @returns {THREE.BufferGeometry}
 */
export function decompToXZGeometry(decomp, { reverse = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  const { vertices, indices, uvs } = decompToXZAttribs(decomp);
  reverse && indices.reverse();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}

/**
 * @param {Geom.Poly[]} polys
 */
function polysToXZAttribs(polys) {
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
  return { vertices, indices, uvs };
}

/**
 * @param {Geom.Triangulation} decomp
 */
function decompToXZAttribs(decomp) {
  const vertices = decomp.vs.flatMap(v => [v.x, 0, v.y]);
  const indices = decomp.tris.flatMap(t => t);
  const bounds = Rect.fromPoints(...decomp.vs);
  const uvs = decomp.vs.flatMap(({ x, y }) => [(x - bounds.x) / bounds.width, (y - bounds.y) / bounds.height]);
  return { vertices, indices, uvs };
}

export const greenWireFrameMat = new THREE.MeshStandardMaterial({
  // wireframe: true,
  color: "green",
  transparent: true,
  opacity: 0.5,
});

export const redWireFrameMat = new THREE.MeshStandardMaterial({
  wireframe: true,
  color: "red",
});

export const tmpVectThree1 = new THREE.Vector3();
export const tmpVectThree2 = new THREE.Vector3();
export const tmpVectThree3 = new THREE.Vector3();
export const tmpMatFour1 = new THREE.Matrix4();
export const tmpMesh1 = new THREE.Mesh();
export const tmpBox1 = new THREE.Box3();

export const imageLoader = new THREE.ImageLoader();
export const textureLoader = new THREE.TextureLoader();
// console.log('cache enabled', THREE.Cache.enabled); // false

const navPathColor = 0x00aa00;
const navNodeColor = 0xaa0000;
export const navMeta = {
  pathColor: navPathColor,
  nodeColor: navNodeColor,
  groundOffset: 0.01,
  lineMaterial: new LineMaterial({
    color: navPathColor,
    linewidth: 0.001,
    // vertexColors: true,
  }),
  nodeMaterial: new THREE.MeshBasicMaterial({ color: navNodeColor }),
  nodeGeometry: new THREE.SphereGeometry(0.08),
};

/**
 * Collects nodes and materials from a THREE.Object3D.
 * @param {THREE.Object3D} object 
 * @returns {import("@react-three/fiber").ObjectMap}
 */
export function buildObjectLookup(object) {
  /** @type {import("@react-three/fiber").ObjectMap} */
  const data = { nodes: {}, materials: {}};
  if (object) {
    object.traverse(/** @param {THREE.Object3D & { material?: THREE.Material }} obj */ obj => {
      if (obj.name) data.nodes[obj.name] = obj;
      if (obj.material && !data.materials[obj.material.name]) {
        data.materials[obj.material.name] = obj.material;
      }
    });
  }
  return data;
}

export const boxGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1);

/**
 * @param {number} width 
 * @param {number} height 
 */
export function createCanvasTexDef(width, height) {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  /** @type {CanvasTexDef} */
  const def = [
    /** @type {CanvasRenderingContext2D} */(el.getContext('2d')),
    new THREE.CanvasTexture(el),
    el,
  ];
  def[1].flipY = false; // align with XZ quad uv-map
  return def;
}

/**
 * @param {THREE.Vector3Like} position
 * @param {THREE.Vector3Like} halfExtent
 */
export function createDebugBox(position, halfExtent) {
  const mesh = new THREE.Mesh(boxGeometry, redWireFrameMat)
  mesh.position.copy(position);
  mesh.scale.set(halfExtent.x * 2, halfExtent.y * 2, halfExtent.z * 2);
  return mesh;
}

/**
 * @param {THREE.Vector3Like} position
 * @param {number} radius
 * @param {number} height
 */
export function createDebugCylinder(position, radius, height) {
  const mesh = new THREE.Mesh(cylinderGeometry, redWireFrameMat)
  mesh.position.copy(position);
  mesh.scale.set(radius, height, radius);
  return mesh;
}

export const yAxis = new THREE.Vector3(0, 1, 0);

export const emptyGroup = new THREE.Group();

export const emptyAnimationMixer = new THREE.AnimationMixer(emptyGroup);

/**
 * @typedef {Pretty<[CanvasRenderingContext2D, THREE.CanvasTexture, HTMLCanvasElement]>} CanvasTexDef
 */
