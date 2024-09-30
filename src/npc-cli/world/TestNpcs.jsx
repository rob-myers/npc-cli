import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { wallHeight } from '../service/const';
import { debug } from '../service/generic';
import { buildObjectLookup, emptyAnimationMixer, emptyTexture, textureLoader } from "../service/three";
import { TestCharacterMaterial } from '../service/glsl';
import { WorldContext } from './world-context';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @param {Props} props
 */
export default function TestNpcs(props) {
  const w = React.useContext(WorldContext);

  classKeyToGltf.hcTest = useGLTF(classKeyToMeta.hcTest.url);
  classKeyToGltf['cuboid-man'] = useGLTF(classKeyToMeta['cuboid-man'].url);

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
      npcClassKey = 'cuboid-man',
    ) {
      const gltf = classKeyToGltf[npcClassKey];
      const meta = classKeyToMeta[npcClassKey];
      debug('saw animations', gltf.animations);

      const clonedScene = SkeletonUtils.clone(gltf.scene);
      const graph = buildObjectLookup(clonedScene);
      const scene = /** @type {THREE.Group} */ (graph.nodes[meta.groupName]);
      // Must be SkinnedMesh i.e. gltf exported with animations
      const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (graph.nodes[meta.meshName]);

      const numVertices = skinnedMesh.geometry.getAttribute('position').count;
      const vertexIds = [...Array(numVertices)].map((_,i) => i);
      skinnedMesh.geometry.setAttribute('vertexId', new THREE.BufferAttribute(new Int32Array(vertexIds), 1));

      /** @type {TestNpc} */
      const character = {
        npcKey,
        act: {},
        bones: Object.values(graph.nodes).filter(/** @returns {x is THREE.Bone} */ (x) =>
          x instanceof THREE.Bone && !(x.parent instanceof THREE.Bone)
        ),
        object: clonedScene,
        initPos: scene.position.clone().add({ x: initPoint.x, y: 0.02, z: initPoint.y }),
        classKey: npcClassKey,
        graph,
        skinnedMesh,
        mixer: emptyAnimationMixer,
        scale: skinnedMesh.scale.clone().multiplyScalar(meta.scale),
        texture: emptyTexture,
      };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (character.graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow

      skinnedMesh.updateMatrixWorld();
      skinnedMesh.computeBoundingBox();
      skinnedMesh.computeBoundingSphere();

      state.npc[npcKey] = character;

      await state.setSkin(npcKey, npcClassKey);
      update();
    },
    onMountNpc(group) {
      if (group !== null) {// mounted
        const npcKey = group.name;
        const npc = state.npc[npcKey];
        state.setupNpcMixer(npc, group);
      }
    },
    onTick(deltaMs) {
      Object.values(state.npc).forEach(x => x.mixer.update(deltaMs));
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
    async setSkin(npcKey, classKey = 'cuboid-man') {
      const npc = state.npc[npcKey];
      const { skinBaseName } = classKeyToMeta[classKey];
      // 🚧 hash instead of Date.now()
      const tex = await textureLoader.loadAsync(`/assets/3d/${skinBaseName}?v=${Date.now()}`);
      tex.flipY = false;
      npc.texture = tex;
    },
    setupNpcMixer(npc, rootGroup) {
      const gltf = classKeyToGltf[npc.classKey];

      const mixer = new THREE.AnimationMixer(rootGroup);
      mixer.timeScale = 1;
      for (const anim of gltf.animations) {
        npc.act[anim.name] = mixer.clipAction(anim);
      }

      if ("Idle" in npc.act) {
        mixer.timeScale = classKeyToMeta[npc.classKey].timeScale["Idle"] ?? 1;
        npc.act["Idle"].reset().fadeIn(0.3).play();
      }

      npc.mixer = mixer;
    }

  }), { preserve: { onMountNpc: true }, reset: { onMountNpc: true } });

  w.debug.npc = state;

  React.useEffect(() => {// Hot reload skins
    Object.values(state.npc).forEach(({ classKey, npcKey }) => state.setSkin(npcKey, classKey))
  }, [w.hash.sheets]);

  return Object.values(state.npc).map(({ npcKey, bones, initPos, graph, skinnedMesh: mesh, scale, texture }) =>
    <group
      key={npcKey}
      position={initPos}
      // dispose={null}
      ref={state.onMountNpc}
      name={npcKey} // hack to lookup npc without "inline ref"
      scale={scale}
    >
      {bones.map((bone, i) => <primitive key={i} object={bone} />)}
      <skinnedMesh
        geometry={mesh.geometry}
        position={mesh.position}
        skeleton={mesh.skeleton}
        // frustumCulled={false}
      >
        {/* <meshPhysicalMaterial key="change_me" map={texture} transparent /> */}
        <testCharacterMaterial
          key={TestCharacterMaterial.key}
          diffuse={[1, 1, 1]}
          transparent
          map={texture}
          labelHeight={wallHeight * (1 / scale.x)}
          selectorColor={[0.6, 0.6, 1]}
          // showSelector={false}
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
 * @property {(group: null | THREE.Group) => void} onMountNpc
 * @property {(deltaMs: number) => void} onTick
 * @property {(npcKey?: string) => void} remove
 * @property {(npcKey: string, charKey?: TestNpcClassKey) => Promise<void>} setSkin
 * @property {(npc: TestNpc, rootGroup: THREE.Group) => void} setupNpcMixer
 */

/**
 * @typedef {'hcTest' | 'cuboid-man'} TestNpcClassKey
 */

/** @type {Record<TestNpcClassKey, TestNpcClassDef>} */
const classKeyToMeta = {
  /** hc ~ hyper casual */
  hcTest: {
    url: '/assets/3d/test-hyper-casual.glb',
    scale: 1,
    materialName: 'Material',
    meshName: 'hc-character-mesh',
    groupName: 'Scene',
    skinBaseName: 'test-hyper-casual.tex.png',
    timeScale: {},
  },
  'cuboid-man': {
    url: '/assets/3d/cuboid-man.glb',
    // scale: 1,
    scale: 0.75,
    materialName: 'cuboid-man-material',
    meshName: 'cuboid-man-mesh',
    groupName: 'Scene',
    skinBaseName: 'cuboid-man.tex.png',
    timeScale: { 'Idle': 0.2, 'Walk': 0.5 },
  },
};

const classKeyToGltf = /** @type {Record<TestNpcClassKey, import("three-stdlib").GLTF>} */ ({})

/**
 * @typedef TestNpc
 * @property {string} npcKey
 * @property {{ [animName: string]: THREE.AnimationAction }} act
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
 * @property {{ [animName: string]: number }} timeScale
 */

useGLTF.preload(Object.values(classKeyToMeta).map(x => x.url));
