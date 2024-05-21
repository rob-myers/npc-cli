import React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { info, range } from "../service/generic";
import { buildGraph } from "../service/three";
import CharacterController from "./character-controller";
import useStateRef from "../hooks/use-state-ref";

const meta = {
  url: '/assets/3d/minecraft-anim.glb', scale: 0.25, height: 2, rotation: undefined,
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
        info('saw animation:', a.name);
        if (a.name === 'Idle' || a.name === 'Walk' || a.name === 'Run') {
          animationMap[a.name] = mixer.clipAction(a);
        }
      });
      const characterController = new CharacterController({
        model: /** @type {THREE.Group} */ (model),
        mixer,
        animationMap,
        opts: { initAnimKey: 'Idle', walkSpeed: meta.walkSpeed, runSpeed: meta.runSpeed, },
      });

      return {
        model,
        controller: characterController,
        graph: buildGraph(model),
      };
    });
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
 * @property {(deltaMs: number) => void} update
 */

useGLTF.preload(meta.url);
