import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { buildObjectLookup, emptyTexture, textureLoader } from "../service/three";
import { TestCharacterMaterial } from '../service/glsl';
import { WorldContext } from './world-context';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @param {Props} props
 */
export default function TestNpcs(props) {
  const w = React.useContext(WorldContext);

  charKeyToGltf.hcTest = useGLTF(charKeyToMeta.hcTest.url);
  charKeyToGltf.cuboidChar = useGLTF(charKeyToMeta.cuboidChar.url);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    npc: /** @type {*} */ ({}),

    /**
     * @param {Geom.VectJson} initPoint 
     * @param {string} [npcKey]
     * @param {TestNpcClassKey} [npcClassKey]
     */
    async add(
      initPoint = { x: 4.5 * 1.5, y: 7 * 1.5 },
      npcKey = `npc-${Object.keys(state.npc).length}`,
      // npcClassKey = 'hcTest',
      npcClassKey = 'cuboidChar',
    ) {
      const gltf = charKeyToGltf[npcClassKey];
      const meta = charKeyToMeta[npcClassKey];

      const object = SkeletonUtils.clone(gltf.scene);
      const graph = buildObjectLookup(object);
      const scene = /** @type {THREE.Group} */ (graph.nodes[meta.groupName]);
      // Must be SkinnedMesh i.e. gltf exported with animations
      const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (graph.nodes[meta.meshName]);

      const numVertices = skinnedMesh.geometry.getAttribute('position').count;
      const vertexIds = [...Array(numVertices)].map((_,i) => i);
      skinnedMesh.geometry.setAttribute('vertexId', new THREE.BufferAttribute(new Int32Array(vertexIds), 1));

      // 🚧
      console.log('animations', gltf.animations);
      const mixer = new THREE.AnimationMixer(object);

      /** @type {TestNpc} */
      const character = {
        npcKey,
        bones: Object.values(graph.nodes).filter(/** @returns {x is THREE.Bone} */ (x) =>
          x instanceof THREE.Bone && !(x.parent instanceof THREE.Bone)
        ),
        object,
        initPos: scene.position.clone().add({ x: initPoint.x, y: 0.02, z: initPoint.y }),
        classKey: npcClassKey,
        graph,
        skinnedMesh,
        mixer,
        scale: skinnedMesh.scale.clone().multiplyScalar(meta.scale),
        texture: emptyTexture,
      };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (character.graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow

      skinnedMesh.updateMatrixWorld();
      skinnedMesh.computeBoundingBox();
      skinnedMesh.computeBoundingSphere();

      state.npc[npcKey] = character;

      const charIndex = Object.keys(state.npc).length - 1;
      await state.setSkin(npcKey, npcClassKey);
      update();
    },
    remove(npcKey) {
      if (npcKey === undefined) {
        for (const npcKey in state.npc) {
          delete state.npc[npcKey];
        }
      } else {
        delete state.npc[npcKey];
      }
      update();
    },
    // 🚧 support multiple skins for single character
    async setSkin(npcKey, charKey = 'cuboidChar') {
      const npc = state.npc[npcKey];
      // 🚧 hash instead of Date.now() ?
      // const tex = await textureLoader.loadAsync(`/assets/3d/${skinKey}?v=${Date.now()}`);
      const { skinBaseName } = charKeyToMeta[charKey];
      const tex = await textureLoader.loadAsync(`/assets/3d/${skinBaseName}?v=${Date.now()}`);
      tex.flipY = false;
      npc.texture = tex;
    },
  }));

  w.debug.npc = state;

  React.useEffect(() => {// Hot reload skins
    Object.values(state.npc).forEach(({ classKey, npcKey }, charIndex) =>
      state.setSkin(npcKey, classKey));
  }, [w.hash.sheets]);

  return Object.values(state.npc).map(({ bones, initPos, graph, skinnedMesh: mesh, scale, texture }, i) =>
    <group
      key={i}
      position={initPos}
      dispose={null}
    >
      {bones.map((bone, i) => <primitive key={i} object={bone} />)}
      <skinnedMesh
        geometry={mesh.geometry}
        position={mesh.position}
        skeleton={mesh.skeleton}
        scale={scale}
        // frustumCulled={false}
      >
        {/* <meshBasicMaterial key="change_me" map={texture} transparent /> */}
        <testCharacterMaterial
          key={TestCharacterMaterial.key}
          diffuse={[1, 1, 1]}
          transparent
          map={texture}
          selectorColor={[0.6, 0.6, 1]}
        />
      </skinnedMesh>
    </group>
  );
}

/**
 * @typedef Props
 * @property {number} [disabled]
 */

/**
 * @typedef State
 * @property {{ [npcKey: string]:  TestNpc }} npc
 * @property {(initPoint?: Geom.VectJson, charKey?: TestNpcClassKey) => Promise<void>} add
 * @property {(npcKey: string, charKey?: TestNpcClassKey) => Promise<void>} setSkin
 * @property {(npcKey?: string) => void} remove
 */

/**
 * @typedef {'hcTest' | 'cuboidChar'} TestNpcClassKey
 */

/** @type {Record<TestNpcClassKey, TestNpcClassDef>} */
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
    // scale: 1,
    scale: 0.75,
    materialName: 'cuboid-character-material',
    meshName: 'cuboid-character-mesh',
    groupName: 'Scene',
    skinBaseName: 'cuboid-character.tex.png',
  },
};

const charKeyToGltf = /** @type {Record<TestNpcClassKey, import("three-stdlib").GLTF>} */ ({})

/**
 * @typedef TestNpc
 * @property {string} npcKey
 * @property {THREE.Bone[]} bones Root bones
 * @property {TestNpcClassKey} classKey
 * @property {import("@react-three/fiber").ObjectMap} graph
 * @property {THREE.Vector3} initPos
 * @property {THREE.Object3D} object
 * @property {THREE.SkinnedMesh} skinnedMesh
 * @property {THREE.AnimationMixer} mixer
 * @property {THREE.Vector3} scale
 * @property {THREE.Texture} texture
 */

/**
 * @typedef TestNpcClassDef
 * @property {string} url e.g. '/assets/3d/test-hyper-casual.glb'
 * @property {number} scale e.g. `1`
 * @property {string} materialName e.g. 'Material'
 * @property {string} meshName e.g. 'hc-character-mesh'
 * @property {string} groupName e.g. 'Scene'
 * @property {string} skinBaseName e.g. 'test-hyper-casual.tex.png'
 */

useGLTF.preload(Object.values(charKeyToMeta).map(x => x.url));
