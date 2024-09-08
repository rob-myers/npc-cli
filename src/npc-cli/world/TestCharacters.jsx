import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { buildObjectLookup, textureLoader } from "../service/three";
import { cameraLightShader } from '../service/glsl';
import { WorldContext } from './world-context';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacters = React.forwardRef(function TestCharacters(props, ref) {
  const w = React.useContext(WorldContext);

  const gltf = useGLTF(meta.url);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    models: /** @type {*} */ ([]),
    add(initPos = [4.5 * 1.5, 0.02, 7 * 1.5], skinKey = testSkins.firstHcTex) {
      const object = SkeletonUtils.clone(gltf.scene);
      const model = { object, initPos, skinKey, graph: buildObjectLookup(object) };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (model.graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow
      
      // // 🚧 support texture map
      // const testMaterial = new THREE.ShaderMaterial({ transparent: true, uniforms: { diffuse: { value: [0.5, 0.5, 0.5] } }, vertexShader: cameraLightShader.Vert, fragmentShader: cameraLightShader.Frag });
      // const mesh = /** @type {THREE.Mesh} */ (model.graph.nodes[meta.meshName]);
      // mesh.material = testMaterial;

      state.models.push(model);
      state.setSkin(0, testSkins.firstHcTex); // 🔔 for skin debug

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
    setSkin(charIndex, skinKey = testSkins.firstHcTex) {
      const model = state.models[charIndex];
      if (!model) {
        return;
      }

      model.skinKey = skinKey;
      const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (model.graph.nodes[meta.meshName]);
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
  
  React.useEffect(() => {// Hot reload skins
    state.models.forEach(({ skinKey }, charIndex) => state.setSkin(charIndex, skinKey));
  }, [w.hash.sheets]);

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
 * @property {{ object: THREE.Object3D; initPos: THREE.Vector3Tuple; skinKey: TestSkinKey; graph: import("@react-three/fiber").ObjectMap }[]} models
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
 * @typedef {testSkins[keyof testSkins]} TestSkinKey
 */

/** hc ~ hyper casual */
const testSkins = /** @type {const} */ ({
  firstHcTex: 'test-hyper-casual.tex.png',
});

useGLTF.preload(meta.url);
