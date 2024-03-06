import * as THREE from "three";

export const customQuadGeometry = new THREE.BufferGeometry();

const vertices = new Float32Array([0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1]);

const uvs = new Float32Array([0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0]);

const indices = [0, 1, 2, 0, 3, 1];
customQuadGeometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
customQuadGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
customQuadGeometry.setIndex(indices);
