import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { CameraControls, MapControls, PerspectiveCamera, KeyboardControls } from "@react-three/drei";
import { quadGeometryXZ } from "../service/three";

import { info } from "../service/generic";
import TestCanvas from "./TestCanvas";
import { TestCharacterController } from "./TestCharacterController";

// 🚧 eliminate KeyboardControls

/**
 * @param {Props} props
 */
export function TestCharacter(props) {
  return (
    <>
      <MapControls makeDefault zoomToCursor position={[0, 8, 0]} />

      {/* <CameraControls makeDefault enabled={!props.disabled} /> */}
      <PerspectiveCamera makeDefault position={[0, 8, 0]} />
      <ambientLight color="white" intensity={0.25} />
      <pointLight
        position={[0, 3, 2]}
        intensity={2}
        castShadow
      />

        <TestCharacterController />

        <mesh
          name="ground"
          scale={[scale, 1, scale]}
          position={[-scale / 2, 0, -scale / 2]}
          geometry={quadGeometryXZ}
          receiveShadow
        >
          <meshStandardMaterial
            side={THREE.DoubleSide}
            color="#ddf"
            // transparent opacity={0.3}
          />
        </mesh>
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

const scale = 20;

/**
 * @param {Pick<import('./TestCanvas').Props, 'disabled' | 'stats'>} props
 */
export default function WrappedTestCharacter(props) {
  return (
    <KeyboardControls map={keyboardMap}>
      <TestCanvas
        disabled={props.disabled}
        stats={props.stats}
        childComponent={TestCharacter}
        childProps={{
          disabled: props.disabled,
        }}
        shadows
      />
    </KeyboardControls>
  );
}

/**
 * @type {import('@react-three/drei').KeyboardControlsEntry<KeyNames>[]}
 */
const keyboardMap = [
  { name: 'w', keys: ['ArrowUp', 'KeyW'] },
  { name: 's', keys: ['ArrowDown', 'KeyS'] },
  { name: 'a', keys: ['ArrowRight', 'KeyA'] },
  { name: 'd', keys: ['ArrowLeft', 'KeyD'] },
  { name: 'shift', keys: ['Shift'] },
];

/**
 * @typedef {import('./character-controller').DirectionKey | 'shift'} KeyNames
 */