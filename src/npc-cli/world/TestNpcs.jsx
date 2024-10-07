import React from 'react';
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { Rect, Vect } from '../geom';
import { wallHeight } from '../service/const';
import { debug, keys, warn } from '../service/generic';
import { buildObjectLookup, emptyAnimationMixer, emptyGroup, emptyTexture, textureLoader, toV3 } from "../service/three";
import { TestCharacterMaterial } from '../service/glsl';
import { WorldContext } from './world-context';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @param {Props} props
 */
export default function TestNpcs(props) {
  const w = React.useContext(WorldContext);

  for (const classKey of keys(classKeyToMeta)) {
    classKeyToGltf[classKey] = useGLTF(classKeyToMeta[classKey].url);
  }

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    npc: /** @type {*} */ ({}),
    quadMeta: /** @type {*} */ ({}),
    unusedDataTex: /** @type {*} */ (null),

    /**
     * @param {Geom.VectJson} point 
     * @param {string} [npcKey]
     * @param {TestNpcClassKey} [npcClassKey]
     */
    async add(
      point = { x: 4.5 * 1.5, y: 7 * 1.5 },
      npcKey = `npc-${keys(state.npc).length}`,
      npcClassKey = 'cuboid-man',
    ) {

      if (npcKey in state.npc) {
        // basic respawn logic e.g. because we don't remount
        const npc = state.npc[npcKey];
        npc.initPosition = toV3(point);
        update();
        return;
      }

      const gltf = classKeyToGltf[npcClassKey];
      const meta = classKeyToMeta[npcClassKey];
      debug('saw animations', gltf.animations.map(x => x.name));

      const clonedScene = SkeletonUtils.clone(gltf.scene);
      const graph = buildObjectLookup(clonedScene);
      const scene = /** @type {THREE.Group} */ (graph.nodes[meta.groupName]);

      // Must be SkinnedMesh i.e. GLTF exported with animations
      const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (graph.nodes[meta.meshName]);

      const numVertices = skinnedMesh.geometry.getAttribute('position').count;
      const vertexIds = [...Array(numVertices)].map((_,i) => i);
      skinnedMesh.geometry.setAttribute('vertexId', new THREE.BufferAttribute(new Int32Array(vertexIds), 1));

      const rootBones = Object.values(graph.nodes).filter(/** @returns {x is THREE.Bone} */ (x) =>
        x instanceof THREE.Bone && !(x.parent instanceof THREE.Bone)
      );

      // state.unusedDataTex ??= state.createTestDataTexture(skinnedMesh);
      const quadMeta = state.quadMeta[npcClassKey] ??= state.preComputeUvOffsets(skinnedMesh);

      /** @type {TestNpc} */
      const npc = {
        npcKey,
        act: {},
        bones: rootBones,
        group: emptyGroup, // overridden on mount
        initPosition: scene.position.clone().add({ x: point.x, y: 0.02, z: point.y }),
        classKey: npcClassKey,
        graph,
        mesh: skinnedMesh,
        mixer: emptyAnimationMixer,
        quad: {
          label: state.cloneUvQuadInstance(quadMeta.label.default),
          face: state.cloneUvQuadInstance(quadMeta.face.default),
          icon: state.cloneUvQuadInstance(quadMeta.icon.default),
        },
        scale: skinnedMesh.scale.clone().multiplyScalar(meta.scale),
        texture: emptyTexture,
      };
      const material = /** @type {THREE.MeshPhysicalMaterial} */ (graph.materials[meta.materialName]);
      material.transparent = true; // For drop shadow

      skinnedMesh.updateMatrixWorld();
      skinnedMesh.computeBoundingBox();
      skinnedMesh.computeBoundingSphere();

      state.npc[npcKey] = npc;

      await state.setSkin(npcKey, npcClassKey);
      update();
    },
    changeUvQuad(npcKey, opts) {
      const npc = state.npc[npcKey];
      const quadMeta = state.quadMeta[npc.classKey];

      if (opts.label) {
        const npcLabel = w.npc.label;
        const srcRect = npcLabel.lookup[opts.label];
        if (!srcRect) {
          throw Error(`${npcKey}: label not found: ${JSON.stringify(opts.label)}`)
        }

        const srcUvRect = Rect.fromJson(srcRect).scale(1 / npcLabel.tex.image.width, 1 / npcLabel.tex.image.height);
        const npcScale = classKeyToMeta[npc.classKey].scale;

        npc.quad.label.uvs = state.instantiateUvDeltas(quadMeta.label.uvDeltas, srcUvRect);
        npc.quad.label.texId = 1; // 🔔 npc.label.tex
        npc.quad.label.dim = [
          0.006 * npcScale * srcRect.width,
          // ℹ️ height ~ 0.13 (13cms) when npcScale is 0.6 
          0.006 * npcScale * srcRect.height,
        ];
      } else if (opts.label === null) {// Reset
        npc.quad.label = state.cloneUvQuadInstance(quadMeta.label.default);
      }

      // face, icon
      for (const quadKey of /** @type {const} */ (['face', 'icon'])) {
        if (opts[quadKey]) {
          const { uvMap } = w.geomorphs.sheet.skins;
          const [uvMapKey, uvKey] = opts[quadKey];
          const srcRect = uvMap[uvMapKey]?.[uvKey];
  
          if (!srcRect) {
            throw Error(`${npcKey}: ${quadKey}: [uvMap, uvKey] not found: ${JSON.stringify(opts[quadKey])}`)
          }
  
          // 🔔 srcRect is already a sub-rect of [0, 1]x[0, 1]
          const srcUvRect = Rect.fromJson(srcRect);
          npc.quad[quadKey].uvs = state.instantiateUvDeltas(quadMeta[quadKey].uvDeltas, srcUvRect);
          npc.quad[quadKey].texId = 0; // 🚧 should follow from uvMapKey
  
        } else if (opts[quadKey] === null) {// Reset
          npc.quad[quadKey] = state.cloneUvQuadInstance(quadMeta[quadKey].default);
        }
      }

      update();
    },
    cloneUvQuadInstance(uvQuadInst) {
      return {// clone quadMeta.label.default
        texId: uvQuadInst.texId,
        dim: /** @type {[number, number]} */ (uvQuadInst.dim.slice()),
        uvs: uvQuadInst.uvs.map(v => v.clone()), // THREE.Vector2
      };
    },
    instantiateUvDeltas(uvDeltas, uvRect) {
      const { center, width, height } = uvRect;
      // 🔔 Array of Geom.VectJSON or [number, number] throws error
      return uvDeltas.map(p => new THREE.Vector2(
        center.x + (width * p.x),
        center.y + (height * p.y),
      ));
    },
    onMountNpc(group) {
      if (group !== null) {// mounted
        const npcKey = group.name;
        const npc = state.npc[npcKey];
        state.setupNpcMixer(npc, group);
        npc.group = group;
      }
    },
    onTick(deltaMs) {
      Object.values(state.npc).forEach(x => x.mixer.update(deltaMs));
    },
    /**
     * Blender Mesh has 32 vertices.
     * 
     * GLTF Mesh has 64 vertices:
     * - (3 * 8) + (3 * 8) + (4 * 4) = 64
     *   i.e. head (cuboid), body (cuboid), 4 quads
     * - head < body < shadow quad < selector quad < icon quad < label quad
     * - concerning face:
     *   - cuboid vertices duped 3 times (adjacently) due to uv map
     *   - via vertex normals, face corresponds to 1st copy (4 times)
     * 
     * ∴ label quad vertex ids: 60, 61, 62, 63
     * ∴ icon quad vertex ids: 56, 57, 58, 59
     * ∴ face quad vertex ids: 3 * 0, 3 * 1, 3 * 4, 3 * 5 
     */
    preComputeUvOffsets(skinnedMesh) {
      const emptyRect = new Rect();
      const emptyUvDeltas = /** @type {Geom.VectJson[]} */ ([]);
      const emptyUvQuadInst = /** @type {UvQuadInstance} */ ({});
      
      /** @type {TestNpcQuadMeta} */
      const quadMeta = {
        face: { vertexIds: [0, 3, 3 * 4, 3 * 5], uvRect: emptyRect, uvDeltas: emptyUvDeltas, default: emptyUvQuadInst },
        icon: { vertexIds: [56, 57, 58, 59], uvRect: emptyRect, uvDeltas: emptyUvDeltas, default: emptyUvQuadInst },
        label: { vertexIds: [60, 61, 62, 63], uvRect: emptyRect, uvDeltas: emptyUvDeltas, default: emptyUvQuadInst },
      };

      const uvs = /** @type {THREE.BufferAttribute} */ (
        skinnedMesh.geometry.getAttribute('uv')
      ).toJSON().array.reduce((agg, x, i, xs) =>
        (i % 2 === 1 && agg.push(new Vect(xs[i - 1], x).precision(6)), agg)
      , /** @type {Geom.VectJson[]} */ ([]));

      // compute uv rects, infer normalized deltas for each corner
      for (const quadKey of keys(quadMeta)) {
        const quad = quadMeta[quadKey];

        const quadUvs = quad.vertexIds.map(vId => uvs[vId]);
        const uvRect = Rect.fromPoints(...quadUvs).precision(6);
        quad.uvRect = uvRect;
        quad.uvDeltas = quadUvs.map(p => ({
          x: p.x === uvRect.x ? -0.5 : 0.5,
          y: p.y === uvRect.y ? -0.5 : 0.5,
        }));

        quad.default = {
          texId: 0, // base skin
          uvs: state.instantiateUvDeltas(quad.uvDeltas, quad.uvRect),
          // inferred from Blender model
          // 'face' and 'icon' have same dimension
          dim: quadKey === 'label' ? [0.75, 0.375] : [0.4, 0.4],
        };
      }

      return quadMeta;
    },
    remove(...npcKeys) {
      if (npcKeys.length === 0) npcKeys = Object.keys(state.npc);
      for (const npcKey of npcKeys) {
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

      if ("Idle" in npc.act) {// default to Idle
        mixer.timeScale = classKeyToMeta[npc.classKey].timeScale["Idle"] ?? 1;
        npc.act["Idle"].reset().fadeIn(0.3).play();
      }

      npc.mixer = mixer;
    },
    /**
     * Considered sending multiple uv-maps via DataTexture
     * but will use multiple uniforms instead.
     */
    unusedCreateDataTexture(skinnedMesh) {
      const meshUvs = /** @type {THREE.BufferAttribute} */ (
        skinnedMesh.geometry.getAttribute('uv')
      ).toJSON().array;

      if (meshUvs.length !== 64 * 2) {
        warn('expected 64 vertices')
      }

      // 64 vertices (width)
      // 8 uv maps 🔔 (height) [all the same i.e. inherited from mesh]
      // 4 (r,g,b,a)
      const data = new Float32Array(64 * 8 * 4);
      let i = 0;
      for(let uvMapId = 0; uvMapId < 8; uvMapId++) {
        for(let vId = 0; vId < 64; vId++) {
          data[i + 0] = meshUvs[2 * vId + 0]
          data[i + 1] = meshUvs[2 * vId + 1]
          data[i + 2] = 0; // texture id
          data[i + 3] = 0; // unused
          i += 4;
        }
      }

      const texture = new THREE.DataTexture(data, 64, 8, THREE.RGBAFormat, THREE.FloatType);
      texture.needsUpdate = true;
      return texture;
    },

  }), {
    preserve: { onMountNpc: true },
    reset: { onMountNpc: false },
    // deps: [classKeyToGltf],
  });

  w.debug.npc = state;

  React.useEffect(() => {// Hot reload skins
    Object.values(state.npc).forEach(({ classKey, npcKey }) => state.setSkin(npcKey, classKey))
  }, [w.hash.sheets]);

  return Object.values(state.npc).map(({ classKey, npcKey, bones, initPosition: initPos, graph, mesh, quad, scale, texture }) =>
    <group
      key={npcKey}
      position={initPos}
      ref={state.onMountNpc}
      name={npcKey} // hack to lookup npc without "inline ref"
      scale={scale}
      // dispose={null}
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
          // map={texture}
          textures={[
            texture, // base skin
            w.npc.label.tex, // labels
          ]}
          labelHeight={wallHeight * (1 / scale.x)}
          // labelHeight={wallHeight * (1 / 0.9)}
          selectorColor={classKey === 'cuboid-man' ? [0.6, 0.6, 1] : [0.8, 0.3, 0.4]}
          // showSelector={false}
          // showLabel={false}
          uLabelTexId={quad.label.texId}
          uLabelUv={quad.label.uvs}
          uLabelDim={quad.label.dim}

          uFaceTexId={quad.face.texId}
          uFaceUv={quad.face.uvs}
          uIconTexId={quad.icon.texId}
          uIconUv={quad.icon.uvs}
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
 * @property {THREE.DataTexture} unusedDataTex
 * @property {Record<TestNpcClassKey, TestNpcQuadMeta>} quadMeta
 * @property {{ [npcKey: string]:  TestNpc }} npc
 *
 * @property {(position?: Geom.VectJson, charKey?: TestNpcClassKey) => Promise<void>} add
 * @property {(input: UvQuadInstance) => UvQuadInstance} cloneUvQuadInstance
 * @property {(npcKey: string, opts: { label?: string | null; face?: [string, string]; icon?: [string, string] }) => void} changeUvQuad
 * @property {(skinnedMesh: THREE.SkinnedMesh) => THREE.DataTexture} unusedCreateDataTexture
 * @property {(uvDeltas: Geom.VectJson[], uvRect: Rect) => THREE.Vector2[]} instantiateUvDeltas
 * @property {(group: null | THREE.Group) => void} onMountNpc
 * @property {(deltaMs: number) => void} onTick
 * @property {(skinnedMesh: THREE.SkinnedMesh) => TestNpcQuadMeta} preComputeUvOffsets
 * @property {(...npcKeys: string[]) => void} remove
 * @property {(npcKey: string, charKey?: TestNpcClassKey) => Promise<void>} setSkin
 * @property {(npc: TestNpc, rootGroup: THREE.Group) => void} setupNpcMixer
 */

/**
 * @typedef {'cuboid-man' | 'cuboid-pet'} TestNpcClassKey
 */

/** @type {Record<TestNpcClassKey, TestNpcClassDef>} */
const classKeyToMeta = {
  'cuboid-man': {
    url: '/assets/3d/cuboid-man.glb',
    scale: 0.6,
    materialName: 'cuboid-man-material',
    meshName: 'cuboid-man-mesh',
    groupName: 'Scene',
    skinBaseName: 'cuboid-man.tex.png',
    timeScale: { 'Idle': 0.2, 'Walk': 0.5 },
  },
  'cuboid-pet': {
    url: '/assets/3d/cuboid-pet.glb',
    // scale: 1,
    scale: 0.6,
    materialName: 'cuboid-pet-material',
    meshName: 'cuboid-pet-mesh',
    groupName: 'Scene',
    skinBaseName: 'cuboid-pet.tex.png',
    timeScale: { 'Idle': 0.4, 'Walk': 0.5 },
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
 * @property {THREE.Vector3} initPosition
 * @property {THREE.Object3D} group
 * @property {THREE.SkinnedMesh} mesh
 * @property {THREE.AnimationMixer} mixer
 * @property {Record<UvQuadKey, UvQuadInstance>} quad
 * These are mutated and fed as uniforms into the shader(s)
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

/**
 * Assumed `deepClone`able.
 * @typedef {{ texId: number; uvs: THREE.Vector2[]; dim: [number, number] }} UvQuadInstance
 */

/**
 * @typedef {Record<UvQuadKey, {
 *   vertexIds: number[];
 *   uvRect: Rect;
 *   uvDeltas: Geom.VectJson[];
 *   default: UvQuadInstance;
 * }>} TestNpcQuadMeta
 */

/**
 * @typedef {'face' | 'icon' | 'label'} UvQuadKey
 */

useGLTF.preload(Object.values(classKeyToMeta).map(x => x.url));
