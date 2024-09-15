import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { buildObjectLookup, emptyTexture, textureLoader } from "../service/three";
import { CameraLightMaterial } from '../service/glsl';
import { WorldContext } from './world-context';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacters = React.forwardRef(function TestCharacters(props, ref) {
  const w = React.useContext(WorldContext);

  charKeyToGltf.hcTest = useGLTF(charKeyToMeta.hcTest.url);
  charKeyToGltf.cuboidChar = useGLTF(charKeyToMeta.cuboidChar.url);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    characters: /** @type {*} */ ([]),

    /**
     * @param {Geom.VectJson} initPoint 
     * @param {CharacterKey} [charKey]
     */
    async add(initPoint = { x: 4.5 * 1.5, y: 7 * 1.5 }, charKey = 'hcTest') {
      const gltf = charKeyToGltf[charKey];
      const meta = charKeyToMeta[charKey];

      const object = SkeletonUtils.clone(gltf.scene);
      const graph = buildObjectLookup(object);
      const scene = /** @type {THREE.Group} */ (graph.nodes[meta.groupName]);

      /** @type {TestCharacter} */
      const character = {
        object,
        initPos: scene.position.clone().add({ x: initPoint.x, y: 0.02, z: initPoint.y }),
        charKey,
        graph: buildObjectLookup(object),
        mesh: /** @type {THREE.Mesh} */ (graph.nodes[meta.meshName]),
        texture: emptyTexture,
      };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (character.graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow

      state.characters.push(character);

      const charIndex = state.characters.length - 1;
      await state.setSkin(charIndex, charKey);
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
    // 🚧 support multiple skins for single character
    async setSkin(charIndex, charKey = 'hcTest') {
      const model = state.characters[charIndex];
      // 🚧 hash instead of Date.now() ?
      // const tex = await textureLoader.loadAsync(`/assets/3d/${skinKey}?v=${Date.now()}`);
      const { skinBaseName } = charKeyToMeta[charKey];
      const tex = await textureLoader.loadAsync(`/assets/3d/${skinBaseName}?v=${Date.now()}`);
      tex.flipY = false;
      model.texture = tex;
    },
  }));

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);
  
  React.useEffect(() => {// Hot reload skins
    state.characters.forEach(({ charKey }, charIndex) => state.setSkin(charIndex, charKey));
  }, [w.hash.sheets]);

  return state.characters.map(({ object, initPos, graph, mesh, texture }, i) =>
    <group key={i} position={initPos}>
      <mesh
        geometry={mesh.geometry}
        position={mesh.position}
        scale={mesh.scale}
      >
        {/* <meshBasicMaterial key="change_me" map={texture} transparent/> */}
        <cameraLightMaterial
          key={CameraLightMaterial.key}
          diffuse={[1, 1, 1]}
          transparent
          map={texture}
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
 * @property {(initPoint?: Geom.VectJson, charKey?: CharacterKey) => Promise<void>} add
 * @property {(charIndex: number, charKey?: CharacterKey) => Promise<void>} setSkin
 * @property {(charIndex?: number) => void} remove
 */

/**
 * @typedef {'hcTest' | 'cuboidChar'} CharacterKey
 */

/** @type {Record<CharacterKey, TestCharacterMeta>} */
const charKeyToMeta = {
  /** hc ~ hyper casual */
  hcTest: {
    url: '/assets/3d/test-hyper-casual.glb',
    scale: 1,
    materialName: 'Material',
    meshName: 'hc-character-mesh',
    groupName: 'Scene',
    skinBaseName: 'test-hyper-casual.tex.png',
  },
  cuboidChar: {
    url: '/assets/3d/cuboid-character.glb',
    scale: 1,
    materialName: 'cuboid-character-material',
    meshName: 'cuboid-character-mesh',
    groupName: 'Scene',
    skinBaseName: 'cuboid-character.tex.png',
  },
};

const charKeyToGltf = /** @type {Record<CharacterKey, import("three-stdlib").GLTF>} */ ({})

/**
 * @typedef TestCharacter
 * @property {CharacterKey} charKey
 * @property {import("@react-three/fiber").ObjectMap} graph
 * @property {THREE.Vector3} initPos
 * @property {THREE.Object3D} object
 * @property {THREE.Mesh | THREE.SkinnedMesh} mesh
 * @property {THREE.Texture} texture
 */

/**
 * @typedef TestCharacterMeta
 * @property {string} url e.g. '/assets/3d/test-hyper-casual.glb'
 * @property {number} scale e.g. `1`
 * @property {string} materialName e.g. 'Material'
 * @property {string} meshName e.g. 'hc-character-mesh'
 * @property {string} groupName e.g. 'Scene'
 * @property {string} skinBaseName e.g. 'test-hyper-casual.tex.png'
 */


useGLTF.preload(Object.values(charKeyToMeta).map(x => x.url));
