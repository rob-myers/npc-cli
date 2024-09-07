import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { buildObjectLookup, textureLoader } from "../service/three";
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacters = React.forwardRef(function TestCharacters(props, ref) {
  const gltf = useGLTF(meta.url);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    models: /** @type {*} */ ([]),
    addModel(skinKey, initPos = [4.5 * 1.5, 0.01, 7 * 1.5]) {
      const model = SkeletonUtils.clone(gltf.scene);
      state.models.push({ model, initPos, graph: buildObjectLookup(model) });
      update();
    },
    changeSkin(charIndex, skinKey) {
      const model = state.models[charIndex];
      if (!model) {
        return;
      }
      const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (
        model.graph.nodes['hc-character-mesh']
      );
      const clonedMaterial = /** @type {THREE.MeshPhysicalMaterial} */ (skinnedMesh.material).clone();

      textureLoader.loadAsync(`/assets/3d/${skinKey}`).then((tex) => {
        // // console.log(material.map, tex);
        // tex.flipY = false;
        // tex.wrapS = tex.wrapT = 1000;
        // tex.colorSpace = "srgb";
        // tex.minFilter = 1004;
        // tex.magFilter = 1003;
        clonedMaterial.map = tex;
        skinnedMesh.material = clonedMaterial;
      });
    },
    removeModel(charIndex) {
      if (state.models[charIndex]) {
        state.models.splice(charIndex, 1);
        update();
      }
    },
    update,
  }));

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

  return state.models.map(({ model, initPos }, i) =>
    <primitive
      key={i}
      object={model}
      position={initPos}
      scale={meta.scale}
      dispose={null}
      // onClick={() => onClick?.(i)}
    />
  );
});

/**
 * @typedef Props
 * @property {number} [disabled]
 */

/**
 * @typedef State
 * @property {{ model: THREE.Object3D; initPos: THREE.Vector3Tuple; graph: import("@react-three/fiber").ObjectMap }[]} models
 * @property {(skinKey: TestSkinKey, initPos?: THREE.Vector3Tuple) => void} addModel 🚧
 * @property {(charIndex: number, skinKey: TestSkinKey) => void} changeSkin 🚧
 * @property {(charIndex: number) => void} removeModel
 * @property {() => void} update
 */

const meta = {
  url: '/assets/3d/test-hyper-casual.glb',
  // scale: 1 / 1.5,
  scale: 1,
  height: 1.5,
};

/**
 * @typedef {'test-hyper-casual.blend.png'} TestSkinKey
 */

useGLTF.preload(meta.url);
