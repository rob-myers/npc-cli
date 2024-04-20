import React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { info } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import CharacterController from "./character-controller";

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacterController = React.forwardRef(function TestCharacterController({
  capsuleHalfHeight = 1.7 / 2,
  capsuleRadius = 0.3 
}, ref) {

  // const { scene: gltf } = useGLTF('/assets/3d/base-mesh-246-tri.glb');
  const { scene: model, animations } = useGLTF('/assets/3d/Soldier.glb');

  const state = useStateRef(/** @returns {State} */ () => ({
    group: /** @type {*} */ (null),
    characterController: /** @type {*} */ (null),

    update(deltaMs) {
      state.characterController.update(deltaMs);
    },
  }));

  React.useMemo(() => void (/** @type {Function} */ (ref)?.(state)), [ref]);

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
 * @property {CharacterController} characterController
 * @property {(deltaMs: number) => void} update
 */
