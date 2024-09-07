import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { buildObjectLookup, textureLoader } from "../service/three";
import { cameraLightShader } from '../service/glsl';
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
    add(initPos = [4.5 * 1.5, 0.02, 7 * 1.5], skinKey = 'test-hyper-casual.blend.png') {
      const object = SkeletonUtils.clone(gltf.scene);
      const model = { object, initPos, graph: buildObjectLookup(object) };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (model.graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow
      
      // // 🚧 support texture map
      // const testMaterial = new THREE.ShaderMaterial({ transparent: true, uniforms: { diffuse: { value: [0.5, 0.5, 0.5] } }, vertexShader: cameraLightShader.Vert, fragmentShader: cameraLightShader.Frag });
      // const mesh = /** @type {THREE.Mesh} */ (model.graph.nodes[meta.meshName]);
      // mesh.material = testMaterial;

      state.models.push(model);
      state.setSkin(0, 'test-hyper-casual.blend.png'); // 🔔 for skin debug

      update();
    },
    remove(charIndex) {
      if (typeof charIndex === 'number') {
        state.models.splice(charIndex, 1);
      } else {
        state.models.length = 0;
      }
      update();
    },
    setSkin(charIndex, skinKey = 'test-hyper-casual.blend.png') {
      const model = state.models[charIndex];
      if (!model) {
        return;
      }
      const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (
        model.graph.nodes['hc-character-mesh']
      );
      const clonedMaterial = /** @type {THREE.MeshPhysicalMaterial} */ (skinnedMesh.material).clone();

      textureLoader.loadAsync(`/assets/3d/${skinKey}?v=${Date.now()}`).then((tex) => {
        // console.log(material.map, tex);
        tex.flipY = false;
        clonedMaterial.map = tex;
        skinnedMesh.material = clonedMaterial;
      });
    },
    update,
  }));

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

  return state.models.map(({ object: model, initPos, graph }, i) =>
    <primitive
      key={i}
      object={model}
      position={initPos}
      scale={meta.scale}
      dispose={null}
    />
  );
});

/**
 * @typedef Props
 * @property {number} [disabled]
 */

/**
 * @typedef State
 * @property {{ object: THREE.Object3D; initPos: THREE.Vector3Tuple; graph: import("@react-three/fiber").ObjectMap }[]} models
 * @property {(initPos?: THREE.Vector3Tuple, skinKey?: TestSkinKey) => void} add 🚧
 * @property {(charIndex: number, skinKey?: TestSkinKey) => void} setSkin 🚧
 * @property {(charIndex?: number) => void} remove
 * @property {() => void} update
 */

const meta = {
  url: '/assets/3d/test-hyper-casual.glb',
  // scale: 1 / 1.5,
  scale: 1,
  height: 1.5,
  materialName: 'Material',
  meshName: 'hc-character-mesh',
};

/**
 * @typedef {'test-hyper-casual.blend.png'} TestSkinKey
 */

useGLTF.preload(meta.url);
