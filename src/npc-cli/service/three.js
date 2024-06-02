import React from "react";
import * as THREE from "three";
import { LineMaterial } from "three-stdlib";
import { Rect, Vect } from "../geom";
import { InfiniteGridMaterial } from "./glsl";

/** Unit quad extending from origin to (1, 0, 1) */
export const quadGeometryXZ = new THREE.BufferGeometry();
// prettier-ignore
const xzVertices = new Float32Array([0, 0, 0,  1, 0, 1,  1, 0, 0,  0, 0, 1]);
const xzUvs = new Float32Array([0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0]);
const xzIndices = [0, 1, 2, 0, 3, 1];
const xzNormals = [0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0]; // Needed for shadows
quadGeometryXZ.setAttribute("position", new THREE.BufferAttribute(xzVertices.slice(), 3));
quadGeometryXZ.setAttribute("uv", new THREE.BufferAttribute(xzUvs.slice(), 2));
quadGeometryXZ.setAttribute( 'normal', new THREE.Float32BufferAttribute( xzNormals.slice(), 3 ) );
quadGeometryXZ.setIndex(xzIndices.slice());

/** Unit quad extending from origin to (1, 1, 0) */
export const quadGeometryXY = new THREE.BufferGeometry();
// prettier-ignore
const xyVertices = new Float32Array([0, 0, 0,  0, 1, 0,  1, 1, 0,  1, 0, 0]);
const xyUvs = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);
const xyIndices = [2, 1, 0, 0, 3, 2];
const xyNormals = [0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1];
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

export const wireFrameMaterial = new THREE.MeshStandardMaterial({
  wireframe: true,
  color: "green",
});

export const tmpVectThree1 = new THREE.Vector3();
export const tmpVectThree2 = new THREE.Vector3();
export const tmpMesh1 = new THREE.Mesh();
export const tmpBox1 = new THREE.Box3();

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
    linewidth: 0.005,
    // vertexColors: true,
  }),
  nodeMaterial: new THREE.MeshBasicMaterial({ color: navNodeColor }),
  nodeGeometry: new THREE.SphereGeometry(0.08),
};

/**
 * https://github.com/Fyrestar/THREE.InfiniteGridHelper/blob/master/InfiniteGridHelper.js
 * @param {InfiniteGridProps & import("@react-three/fiber").MeshProps} props
 */
export function InfiniteGrid(props) {
  const { size1, size2, color, distance, ...meshProps } = props;
  return (
    <mesh {...meshProps} >
      {/* saw jitter when only 1 subdivision and camera close (?) */}
      <planeGeometry args={[1000, 1000, 2, 2]} />
      <infiniteGridMaterial
        key={InfiniteGridMaterial.key}
        uSize1={size1 ?? 10}
        uSize2={size2 ?? 10}
        uColor={new THREE.Color(color ?? "black")}
        uDistance={distance ?? 100}
        side={THREE.DoubleSide}
        transparent
      />
    </mesh>
  );
}

/**
 * @typedef InfiniteGridProps
 * @property {number} [size1]
 * @property {number} [size2]
 * @property {THREE.Color | string | number} [color]
 * @property {number} [distance]
 */

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

export const yAxis = new THREE.Vector3(0, 1, 0);

export const emptyGroup = new THREE.Group();

export const emptyAnimationMixer = new THREE.AnimationMixer(emptyGroup);
