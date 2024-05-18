import React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { info } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import CharacterController from "./character-controller";

const meta = /** @type {const} */ ({
  'base-mesh-246-tri': { url: '/assets/3d/base-mesh-246-tri.glb', scale: 1, height: 1.7, rotation: undefined },
  soldier: { url: '/assets/3d/Soldier.glb', scale: 1, height: 1.7, rotation: /** @type {THREE.Vector3Tuple} */ ([0, Math.PI, 0]) },
  mixamo: { url: '/assets/3d/mixamo-test.glb', scale: 1, height: 1.7, rotation: undefined },
  minecraft: { url: '/assets/3d/minecraft-anim.glb', scale: 0.25, height: 2, rotation: undefined },
});

const chosen = meta.minecraft;

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const TestCharacterController = React.forwardRef(function TestCharacterController({
  cylinderHalfHeight = chosen.height / 2,
  cylinderRadius = 0.3,
}, ref) {

  const { scene: model, animations } = useGLTF(chosen.url);
  // console.log(model.children[0].children);

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
        // x.material.metalness = 0;
        // x.material.metalness = 1;
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
    <group
      ref={x => x && (state.group = x)}
      scale={chosen.scale}
    >
      <mesh
        position={[0, cylinderHalfHeight / chosen.scale, 0]}
        scale={1 / chosen.scale}
        visible={false}
      >
        <meshStandardMaterial color="red" wireframe />
        <cylinderGeometry args={[cylinderRadius, cylinderRadius, cylinderHalfHeight * 2]} />
      </mesh>
      <primitive
        object={model}
        rotation={chosen.rotation}
      />
    </group>
  );
});

/**
 * @typedef Props
 * @property {number} [cylinderHalfHeight]
 * @property {number} [cylinderRadius]
 */

/**
 * @typedef State
 * @property {THREE.Group} group
 * @property {CharacterController} characterController
 * @property {(deltaMs: number) => void} update
 */
