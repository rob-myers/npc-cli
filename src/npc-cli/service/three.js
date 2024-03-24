import * as THREE from "three";

// prettier-ignore
const xzVertices = new Float32Array([0, 0, 0,  1, 0, 1,  1, 0, 0,  0, 0, 1]);
const xzUvs = new Float32Array([0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0]);
const xzUvIndices = [0, 1, 2, 0, 1, 3];

export const quadGeometryXZ = new THREE.BufferGeometry();
quadGeometryXZ.setAttribute("position", new THREE.BufferAttribute(xzVertices.slice(), 3));
quadGeometryXZ.setAttribute("uv", new THREE.BufferAttribute(xzUvs.slice(), 2));
quadGeometryXZ.setIndex(xzUvIndices.slice());

// prettier-ignore
const xyVertices = new Float32Array([0, 0, 0,  0, 1, 0,  1, 1, 0,  1, 0, 0]);
const xyUvs = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);
const xyUvIndices = [2, 1, 0, 0, 3, 2];

export const quadGeometryXY = new THREE.BufferGeometry();
quadGeometryXY.setAttribute("position", new THREE.BufferAttribute(xyVertices.slice(), 3));
quadGeometryXY.setAttribute("uv", new THREE.BufferAttribute(xyUvs.slice(), 2));
quadGeometryXY.setIndex(xyUvIndices.slice());
