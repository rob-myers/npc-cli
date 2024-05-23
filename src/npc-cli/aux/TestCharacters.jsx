import React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { info, range } from "../service/generic";
import { buildGraph, textureLoader } from "../service/three";
import CharacterController from "./character-controller";
import useStateRef from "../hooks/use-state-ref";

const meta = {
  url: '/assets/3d/minecraft-anim.glb',
  scale: 0.25, height: 2, rotation: undefined,
  walkSpeed: 1.25, runSpeed: 2.5,
};

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacters = React.forwardRef(function TestCharacters({
  count = 5,
  onClick,
}, ref) {
  const gltf = useGLTF(meta.url);

  const state = useStateRef(/** @returns {State} */ () => ({
    models: /** @type {*} */ ([]),
    changeSkin(charIndex, skinKey) {
      const model = state.models[charIndex];
      if (!model) {
        return;
      }
      const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (
        model.graph.nodes['minecraft-character-mesh']
      );
      const clonedMaterial = /** @type {THREE.MeshPhysicalMaterial} */ (skinnedMesh.material).clone();

      textureLoader.loadAsync(`/assets/3d/minecraft-skins/${skinKey}`).then((tex) => {
        // console.log(material.map, tex);
        tex.flipY = false;
        tex.wrapS = tex.wrapT = 1000;
        tex.colorSpace = "srgb";
        tex.minFilter = 1004;
        tex.magFilter = 1003;
        clonedMaterial.map = tex;
        skinnedMesh.material = clonedMaterial;
      });
    },
    update(deltaMs) {
      state.models.forEach(({ controller }) => controller.update(deltaMs));
    },
  }));

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);
  useFrame((_, deltaMs) => state.update(deltaMs));

  state.models = React.useMemo(() => {
    return range(count).map(_ => {
      const model = SkeletonUtils.clone(gltf.scene);

      const mixer = new THREE.AnimationMixer(model);
      const animationMap = /** @type {Record<import("./character-controller").AnimKey, THREE.AnimationAction>} */ ({});
      gltf.animations.forEach(a => {
        // info('saw animation:', a.name);
        if (a.name === 'Idle' || a.name === 'Walk' || a.name === 'Run') {
          animationMap[a.name] = mixer.clipAction(a);
        }
      });
      const controller = new CharacterController({
        model: /** @type {THREE.Group} */ (model),
        mixer,
        animationMap,
        opts: { initAnimKey: 'Idle', walkSpeed: meta.walkSpeed, runSpeed: meta.runSpeed, },
      });

      return { model, controller, graph: buildGraph(model) };
    });
  }, [gltf.scene]);
  // console.log(state.models[0]?.graph.nodes["minecraft-character-mesh"].geometry.attributes.position);

  React.useEffect(() => {
    state.changeSkin(0, 'minecraft-alex-with-arms.png');
    state.changeSkin(1, 'minecraft-steve.png');
    state.changeSkin(2, 'vaccino-64x64.png');
    state.changeSkin(3, 'minecraft-zuri.png');
  }, [gltf.scene]);


  return state.models.map(({ model }, i) =>
    <primitive
      key={i}
      object={model}
      position={[i * 2, 0, 0]}
      scale={0.25}
      dispose={null}
      onClick={() => onClick?.(i)}
    />
  );
});

/**
 * @typedef Props
 * @property {number} [count]
 * @property {(characterIndex: number) => void} [onClick]
 */

/**
 * @typedef State
 * @property {{ model: THREE.Object3D; controller: CharacterController; graph: import("@react-three/fiber").ObjectMap }[]} models
 * @property {(charIndex: number, skinKey: SkinKey) => void} changeSkin
 * @property {(deltaMs: number) => void} update
 */

useGLTF.preload(meta.url);

/**
 * @typedef {(
 * | 'minecraft-alex-with-arms.png'
 * | 'minecraft-ari.png'
 * | 'minecraft-efe-with-arms.png'
 * | 'minecraft-kai.png'
 * | 'minecraft-makena-with-arms.png'
 * | 'minecraft-noor-with-arms.png'
 * | 'minecraft-steve.png'
 * | 'minecraft-sunny.png'
 * | 'minecraft-zuri.png'
 * | 'vaccino-64x64.png'
 * )} SkinKey
 */