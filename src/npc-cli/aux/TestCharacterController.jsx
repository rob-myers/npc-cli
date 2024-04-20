import React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { info } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import CharacterController from "./character-controller";

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacterController = React.forwardRef(function TestCharacterController(
  { capsuleHalfHeight = 1.7 / 2, capsuleRadius = 0.3 },
  ref
) {

  // const { scene: gltf } = useGLTF('/assets/3d/base-mesh-246-tri.glb');
  const { scene: model, animations } = useGLTF('/assets/3d/Soldier.glb');

  const state = useStateRef(/** @returns {State} */ () => ({
    group: /** @type {*} */ (null),
    keyPressed: { w: false, a: false, s: false, d: false, shift: false },
    characterController: /** @type {*} */ (null),

    setTarget(target) {
      state.characterController.setTarget(target);
    },
    update(deltaMs) {
      // state.characterController.updateOnKey(deltaMs, state.keyPressed);
      state.characterController.updateOnTarget(deltaMs);
    },
  }));

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

  const [sub, _get] = useKeyboardControls();

  React.useEffect(() => {
    model.traverse(x => {
      if (x instanceof THREE.Mesh && x.material instanceof THREE.MeshStandardMaterial) {
        x.material.metalness = 0;
        x.castShadow = true;
      }
    });

    const mixer = new THREE.AnimationMixer(model);
    const animationMap = /** @type {Record<import("./character-controller").AnimKey, THREE.AnimationAction>} */ ({});
    animations.forEach(a => {
      info('saw animation:', a.name);
      if (a.name === 'Idle' || a.name === 'Walk' || a.name === 'Run') {
        animationMap[a.name] = mixer.clipAction(a);
      }
    });

    state.characterController = new CharacterController({
      model: state.group,
      mixer,
      animationMap,
      initialAction: 'Idle',
    });
  }, []);

  React.useEffect(() => 
    sub((x) => x, (keyState) => {
      info('keypress', keyState);
      state.characterController.shouldRun = keyState.shift;
      Object.entries(keyState).forEach(([k, v]) =>
        state.keyPressed[/** @type {import('./TestCharacter').KeyNames} */ (k)] = v
      );
    })
  , []);

  useFrame((_, deltaMs) => state.update(deltaMs));

  return (
    <group ref={x => x && (state.group = x)}>
      <mesh
        position={[0, capsuleHalfHeight, 0]}
        visible={false}
      >
        <meshStandardMaterial color="red" wireframe />
        <cylinderGeometry args={[capsuleRadius, capsuleRadius, capsuleHalfHeight * 2]} />
      </mesh>
      <primitive object={model} rotation={[0, Math.PI, 0]} />
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
 * @property {THREE.Group} group
 * @property {Record<import('./TestCharacter').KeyNames, boolean>} keyPressed
 * @property {CharacterController} characterController
 * @property {(target: THREE.Vector3Like) => void} setTarget
 * @property {(deltaMs: number) => void} update
 */
