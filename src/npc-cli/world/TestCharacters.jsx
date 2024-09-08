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
    characters: /** @type {*} */ ([]),
    add(initPos = { x: 4.5 * 1.5, y: 7 * 1.5 }, skinKey = testSkins.firstHcTex) {
      const object = SkeletonUtils.clone(gltf.scene);
      /** @type {TestCharacter} */
      const character = { object, initPos, skinKey, graph: buildObjectLookup(object) };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (character.graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow
      
      // // 🚧 support texture map
      // const testMaterial = new THREE.ShaderMaterial({ transparent: true, uniforms: { diffuse: { value: [0.5, 0.5, 0.5] } }, vertexShader: cameraLightShader.Vert, fragmentShader: cameraLightShader.Frag });
      // const mesh = /** @type {THREE.Mesh} */ (model.graph.nodes[meta.meshName]);
      // mesh.material = testMaterial;

      state.characters.push(character);
      const charIndex = state.characters.length - 1;
      state.setSkin(charIndex, testSkins.firstHcTex); // 🔔 for skin debug

      update();
    },
    remove(charIndex) {
      if (typeof charIndex === 'number') {
        state.characters.splice(charIndex, 1);
      } else {
        state.characters.length = 0;
      }
      update();
    },
    setSkin(charIndex, skinKey = testSkins.firstHcTex) {
      const model = state.characters[charIndex];
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
    state.characters.forEach(({ skinKey }, charIndex) => state.setSkin(charIndex, skinKey));
  }, [w.hash.sheets]);

  return state.characters.map(({ object: model, initPos, graph }, i) =>
    <primitive
      key={i}
      object={model}
      position={[initPos.x, 0.02, initPos.y]}
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
 * @property {TestCharacter[]} characters
 * @property {(initPos?: Geom.VectJson, skinKey?: TestSkinKey) => void} add
 * @property {(charIndex: number, skinKey?: TestSkinKey) => void} setSkin
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
/**
 * @typedef TestCharacter
 * @property {THREE.Object3D} object
 * @property {Geom.VectJson} initPos
 * @property {TestSkinKey} skinKey
 * @property {import("@react-three/fiber").ObjectMap} graph
 */

/** hc ~ hyper casual */
const testSkins = /** @type {const} */ ({
  firstHcTex: 'test-hyper-casual.tex.png',
});

useGLTF.preload(meta.url);
