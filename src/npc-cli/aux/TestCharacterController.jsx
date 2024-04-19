import React from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { info } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import CharacterControls from "./character-controller";

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacterController = React.forwardRef(function TestCharacterController(
  { capsuleHalfHeight = 0.35, capsuleRadius = 0.3 },
  ref
) {

  const { camera, controls } = useThree();

  // const { scene: gltf } = useGLTF('/assets/3d/base-mesh-246-tri.glb');
  const { scene: model, animations } = useGLTF('/assets/3d/Soldier.glb');

  const state = useStateRef(/** @returns {State} */ () => ({
    // 🚧
    keyPressed: { w: false, a: false, s: false, d: false, shift: false },
    characterController: /** @type {*} */ (null),
    update(deltaMs) {
      state.characterController.update(deltaMs, state.keyPressed);
    },
  }));

  state.characterController = React.useMemo(() => {
    model.traverse(x => {
      if (x instanceof THREE.Mesh && x.material instanceof THREE.MeshStandardMaterial) {
        x.material.metalness = 0;
        x.castShadow = true;
        // x.material = new THREE.MeshToonMaterial({ color : 0xffffff, wireframe : false})
      }
    });

    const mixer = new THREE.AnimationMixer(model);
    const animationMap = /** @type {Record<import("./character-controller").AnimKey, THREE.AnimationAction>} */ ({});
    animations.forEach(a => {
      info('saw animation:', a.name);
      if (a.name === 'Idle' || a.name === 'Walk' || a.name === 'Run') {
        animationMap[a.name] = mixer.clipAction(a);
      }
    }
    );

    return new CharacterControls({
      model,
      mixer,
      animationMap,
      camera: /** @type {THREE.PerspectiveCamera} */ (camera),
      initialAction: 'Idle',
      orbitControls: /** @type {import('three-stdlib').OrbitControls} */ (controls),
    });
  }, [controls]);

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

  const [sub, _get] = useKeyboardControls();
  React.useEffect(() => 
    sub((x) => x, (keyState) => {
      info('keypress', keyState);
      state.characterController.canRun = keyState.shift;
      Object.entries(keyState).forEach(([k, v]) =>
        state.keyPressed[/** @type {import('./TestCharacter').KeyNames} */ (k)] = v
      );
    })
  , []);

  useFrame((_, deltaMs) => state.update(deltaMs));

  return (
    <group>
      <primitive object={model} />
    </group>
  );
});

/**
 * @typedef Props
 * @property {number} [capsuleHalfHeight]
 * @property {number} [capsuleRadius]
 */

/**
 * @typedef State
 * @property {Record<import('./TestCharacter').KeyNames, boolean>} keyPressed
 * @property {CharacterControls} characterController
 * @property {(deltaMs: number) => void} update
 */
