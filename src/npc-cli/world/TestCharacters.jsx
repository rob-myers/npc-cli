import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { buildObjectLookup, emptyTexture, textureLoader } from "../service/three";
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

    async add(initPoint = { x: 4.5 * 1.5, y: 7 * 1.5 }, skinKey = testSkins.firstHcTex) {
      const object = SkeletonUtils.clone(gltf.scene);
      const graph = buildObjectLookup(object);
      const scene = /** @type {THREE.Group} */ (graph.nodes[meta.groupName]);

      /** @type {TestCharacter} */
      const character = {
        object,
        initPos: scene.position.clone().add({ x: initPoint.x, y: 0.02, z: initPoint.y }),
        skinKey,
        graph: buildObjectLookup(object),
        mesh: /** @type {THREE.Mesh} */ (graph.nodes[meta.meshName]),
        texture: emptyTexture,
      };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (character.graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow
      
      // // 🚧 support texture map
      // const testMaterial = new THREE.ShaderMaterial({ transparent: true, uniforms: { diffuse: { value: [0.5, 0.5, 0.5] } }, vertexShader: cameraLightShader.Vert, fragmentShader: cameraLightShader.Frag });
      // const mesh = /** @type {THREE.Mesh} */ (model.graph.nodes[meta.meshName]);
      // mesh.material = testMaterial;

      state.characters.push(character);

      const charIndex = state.characters.length - 1;
      await state.setSkin(charIndex, testSkins.firstHcTex);
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
    async setSkin(charIndex, skinKey = testSkins.firstHcTex) {
      const model = state.characters[charIndex];
      model.skinKey = skinKey;
      // 🚧 hash instead of Date.now() ?
      const tex = await textureLoader.loadAsync(`/assets/3d/${skinKey}?v=${Date.now()}`);
      tex.flipY = false;
      model.texture = tex;
    },
    update,
  }));

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);
  
  React.useEffect(() => {// Hot reload skins
    state.characters.forEach(({ skinKey }, charIndex) => state.setSkin(charIndex, skinKey));
  }, [w.hash.sheets]);

  return state.characters.map(({ object, initPos, graph, mesh, texture }, i) =>
    // <primitive
    //   key={i}
    //   object={object}
    //   position={[initPos.x, 0.02, initPos.y]}
    //   scale={meta.scale}
    //   dispose={null}
    // />
    <group
      key={i}
      position={initPos}
      dispose={null}
    >
      <mesh
        geometry={mesh.geometry}
        position={mesh.position}
        scale={mesh.scale}
      >
        <meshPhysicalMaterial
          // color="blue"
          map={texture}
          transparent
        />
      </mesh>
    </group>
  );
});

/**
 * @typedef Props
 * @property {number} [disabled]
 */

/**
 * @typedef State
 * @property {TestCharacter[]} characters
 * @property {(initPoint?: Geom.VectJson, skinKey?: TestSkinKey) => Promise<void>} add
 * @property {(charIndex: number, skinKey?: TestSkinKey) => Promise<void>} setSkin
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
  groupName: 'Scene',
};

/**
 * @typedef {testSkins[keyof testSkins]} TestSkinKey
 */
/**
 * @typedef TestCharacter
 * @property {import("@react-three/fiber").ObjectMap} graph
 * @property {THREE.Vector3} initPos
 * @property {THREE.Object3D} object
 * @property {THREE.Mesh | THREE.SkinnedMesh} mesh
 * @property {TestSkinKey} skinKey
 * @property {THREE.Texture} texture
 */

/** hc ~ hyper casual */
const testSkins = /** @type {const} */ ({
  firstHcTex: 'test-hyper-casual.tex.png',
});

useGLTF.preload(meta.url);
