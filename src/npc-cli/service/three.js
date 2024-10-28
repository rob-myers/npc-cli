/**
 * Also used by web worker.
 */
import * as THREE from "three";
import { LineMaterial } from "three-stdlib";
import { Rect, Vect } from "../geom";
import packRectangles from "./rects-packer";

/** Unit quad extending from (0, 0, 0) to (1, 0, 1) */
const quadGeometryXZ = new THREE.BufferGeometry();
const xzVertices = new Float32Array([0,0,0, 1,0,0, 1,0,1, 0,0,1]);
const xzUvs = new Float32Array([0,0, 1,0, 1,1, 0,1]);
const xzIndices = [2, 1, 0, 0, 3, 2];
const xzNormals = [0,1,0, 0,1,0, 0,1,0, 0,1,0]; // For shadows
quadGeometryXZ.setAttribute("position", new THREE.BufferAttribute(xzVertices.slice(), 3));
quadGeometryXZ.setAttribute("uv", new THREE.BufferAttribute(xzUvs.slice(), 2));
quadGeometryXZ.setAttribute("normal", new THREE.Float32BufferAttribute( xzNormals.slice(), 3 ) );
quadGeometryXZ.setIndex(xzIndices.slice());

/** Cache to avoid re-creation on HMR */
const quadXZLookup = /** @type {Record<string, THREE.BufferGeometry>} */ ({});

const colorLookup = /** @type {Record<string, THREE.Color>} */ ({});

const rotMatLookup = /** @type {Record<string, THREE.Matrix4>} */ ({});

/**
 * Clone to avoid overwriting attributes used by custom shaders
 * @param {string} key
 */
export function getQuadGeometryXZ(key) {
  return quadXZLookup[key] ??= quadGeometryXZ.clone();
}

/**
 * @param {string} colorRep 
 */
export function getColor(colorRep) {
  return colorLookup[colorRep] ??= new THREE.Color(colorRep);
}

/**
 * Get a matrix which rotates around unit vector.
 * 🔔 May be mutated for "rotation around a point",
 * @see getRotAxisMatrix
 * @param {number} ux unit vector x
 * @param {number} uy unit vector y
 * @param {number} uz unit vector z
 * @param {number} degrees 
 */
export function getRotAxisMatrix(ux, uy, uz, degrees) {
  const key = `${ux} ${uy} ${uz} ${degrees}`;
  return rotMatLookup[key] ??= new THREE.Matrix4().makeRotationAxis(
    tmpVectThree1.set(ux, uy, uz),
    degrees * (Math.PI / 180),
  );
}

/**
 * Mutate matrix `mat` so that:
 * > `mat := translate(cx, cy, cz) . mat . translate(-cx, -cy, -cz)`
 * @param {THREE.Matrix4} mat 
 * @param {number} cx
 * @param {number} cy
 * @param {number} cz
 * @returns {THREE.Matrix4}
 */
export function setRotMatrixAboutPoint(mat, cx, cy, cz) {
  const me = mat.elements;
  mat.elements[12] = (me[0] * -cx + me[4] * -cy + me[8 ] * -cz) + cx;
  mat.elements[13] = (me[1] * -cx + me[5] * -cy + me[9 ] * -cz) + cy;
  mat.elements[14] = (me[2] * -cx + me[6] * -cy + me[10] * -cz) + cz;
  return mat;
}

/** Unit quad extending from (0, 0, 0) to (1, 1, 0) */
const quadGeometryXY = new THREE.BufferGeometry();
const xyVertices = new Float32Array([0,0,0, 0,1,0, 1,1,0, 1,0,0]);
const xyUvs = new Float32Array([0,1, 0,0, 1,0, 1,1]); // flipY false, Origin at topLeft of image
const xyIndices = [2, 1, 0, 0, 3, 2];
const xyNormals = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
quadGeometryXY.setAttribute("position", new THREE.BufferAttribute(xyVertices.slice(), 3));
quadGeometryXY.setAttribute("uv", new THREE.BufferAttribute(xyUvs.slice(), 2));
quadGeometryXZ.setAttribute( 'normal', new THREE.Float32BufferAttribute( xyNormals.slice(), 3 ) );
quadGeometryXY.setIndex(xyIndices.slice());

/** Cache to avoid re-creation on HMR */
const quadXYLookup = /** @type {Record<string, THREE.BufferGeometry>} */ ({});

/**
 * Clone to avoid overwriting attributes used by custom shaders
 * @param {string} key
 */
export function getQuadGeometryXY(key) {
  return quadXYLookup[key] ??= quadGeometryXY.clone();
}

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
export const emptyTexture = new THREE.Texture();
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

export const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1);

/**
 * @param {number} width 
 * @param {number} height 
 * @param {object} [opts]
 * @param {boolean} [opts.willReadFrequently]
 * @param {number} [opts.texId]
 * @returns {CanvasTexMeta}
 */
export function createCanvasTexMeta(width, height, opts) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false; // align with XZ quad uv-map
  const ct = /** @type {CanvasRenderingContext2D} */(canvas.getContext(
    '2d',
    { willReadFrequently: opts?.willReadFrequently },
  ));
  return { canvas, tex, ct, texId : opts?.texId ?? null };
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

/**
 * Expects possibly empty (a) rects lookup, (b) texture,
 * where it will write the output.
 * 
 * We cannot "extend" an existing sprite-sheet because maxrect-packer
 * does not support this i.e. it won't necessarily respect constraints (x, y).
 * Consequently we must re-create every time.
 * 
 * @param {string[]} labels Assumed to be duplicate-free.
 * @param {LabelsSheetAndTex} sheet The sprite-sheet we'll create/mutate.
 * @param {{ fontHeight: number; }} opts
 */
export function createLabelSpriteSheet(labels, sheet, { fontHeight }) {
  if (labels.length === sheet.numLabels && labels.every(label => label in sheet.lookup)) {
    return; // Avoid re-computation
  }

  // Create sprite-sheet
  const canvas = /** @type {HTMLCanvasElement} */ (sheet.tex.image);
  const ct = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ct.font = `${fontHeight}px 'Courier new'`;

  const rects = labels.map(label => ({
    width: ct.measureText(label).width,
    height: fontHeight,
    data: { label },
  }));

  const bin = packRectangles(rects, { logPrefix: 'w.extendLabels', packedPadding: 2 });

  sheet.lookup = bin.rects.reduce((agg, r) => {
    agg[r.data.label] = { x: r.x, y: r.y, width: r.width, height: r.height };
    return agg;
  }, /** @type {LabelsSheetAndTex['lookup']} */ ({}));
  sheet.numLabels = labels.length;
  
  // Draw sprite-sheet
  if (canvas.width !== bin.width || canvas.height !== bin.height) {
    sheet.tex.dispose();
    [canvas.width, canvas.height] = [bin.width, bin.height];
    sheet.tex = new THREE.CanvasTexture(canvas);
    sheet.tex.flipY = false;
  }
  ct.clearRect(0, 0, bin.width, bin.height);
  ct.strokeStyle = ct.fillStyle = 'white';
  ct.font = `${fontHeight}px 'Courier new'`;
  ct.textBaseline = 'top';
  bin.rects.forEach(rect => {
    ct.fillText(rect.data.label, rect.x, rect.y);
    ct.strokeText(rect.data.label, rect.x, rect.y);
  });

  sheet.tex.needsUpdate = true;
}

export const yAxis = new THREE.Vector3(0, 1, 0);

export const emptyGroup = new THREE.Group();

export const emptyAnimationMixer = new THREE.AnimationMixer(emptyGroup);

/**
 * @typedef CanvasTexMeta
 * @property {CanvasRenderingContext2D} ct
 * @property {THREE.CanvasTexture} tex
 * @property {HTMLCanvasElement} canvas
 * @property {null | number} texId
 */

export const emptySceneForPicking = new THREE.Scene();

/**
 * This is the 1x1 pixel render target we use to do object picking.
 */
export const pickingRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
});

/**
 * @typedef LabelsSheetAndTex
 * @property {{ [label: string]: Geom.RectJson }} lookup
 * @property {number} numLabels
 * @property {THREE.CanvasTexture} tex
 */

/**
 * - identity on `THREE.Vector3`
 * - convert { x, y, z } to `new THREE.Vector3(x, y, z)`
 * - convert {x, y } to `new THREE.Vector3(x, 0, y)`
 * @param {Geom.VectJson | THREE.Vector3Like} input 
 */
export function toV3(input) {
  return 'z' in input
    ? input instanceof THREE.Vector3 ? input : new THREE.Vector3().copy(input)
    : new THREE.Vector3(input.x, 0, input.y)
  ;
}

export const defaultQuadUvs = [...Array(4)].map(_ => new THREE.Vector2());

/**
 * - precision 6
 * @param {THREE.BufferGeometry} geometry 
 * @returns {Geom.VectJson[]}
 */
export function getGeometryUvs(geometry) {
  return /** @type {THREE.BufferAttribute} */ (
    geometry.getAttribute('uv')
  ).toJSON().array.reduce((agg, x, i, xs) =>
    (i % 2 === 1 && agg.push(new Vect(xs[i - 1], x).precision(6)), agg)
  , /** @type {Geom.VectJson[]} */ ([]));
}

/**
 * @param {THREE.Object3D[]} objs 
 * @returns {THREE.Bone[]}
 */
export function getParentBones(objs) {
  return objs.filter(/** @returns {x is THREE.Bone} */ (x) =>
    x instanceof THREE.Bone && !(x.parent instanceof THREE.Bone)
  );
}

/**
 * @template {{ material: THREE.Material }} T
 * @param {T} o
 * @returns {o is (T & { material: THREE.ShaderMaterial })}
 */
export function hasObjectPickShaderMaterial(o) {
  return (
    o.material instanceof THREE.ShaderMaterial
    && 'objectPick' in o.material.uniforms
  );
}
