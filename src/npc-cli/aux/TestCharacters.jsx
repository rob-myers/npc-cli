import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { range } from "../service/generic";
import { buildGraph } from "../service/three";

const meta = {
  url: '/assets/3d/minecraft-anim.glb', scale: 0.25, height: 2, rotation: undefined,
  walkSpeed: 1.25, runSpeed: 2.5,
};

/**
 * @param {Props} arg0
 */
export default function TestCharacters({ count = 5 }) {
  const gltf = useGLTF(meta.url);

  const models = React.useMemo(() => {
    range(count).forEach(i => {// Ensure clones
      if (!cloneCache[i]) {
        const scene = SkeletonUtils.clone(gltf.scene);
        cloneCache[i] = { root: scene, graph: buildGraph(scene) };
      }
    });
    return cloneCache.slice(0, count);
  }, [gltf.scene]);

  return models.map((model, i) =>
    <primitive
      key={i}
      object={model.root}
      position={[i * 2, 0, 0]}
      scale={0.25}
      dispose={null}
    />
  );
}

/**
 * @typedef Props
 * @property {number} [count]
 */

/** @type {{ root: THREE.Object3D; graph: import("@react-three/fiber").ObjectMap }[]} */
const cloneCache = [];

useGLTF.preload(meta.url);
