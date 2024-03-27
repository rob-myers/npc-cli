import React from "react";
import * as THREE from "three";
import {
  CameraControls,
  Edges,
  KeyboardControls,
  MapControls,
  PerspectiveCamera,
} from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import { quadGeometryXZ } from "../service/three";

import TestCanvas from "./TestCanvas";

/**
 * @param {Props} props
 */
export function TestCharacter(props) {
  return (
    <>
      {/* <MapControls makeDefault zoomToCursor position={[0, 8, 0]} /> */}
      <CameraControls makeDefault enabled={!props.disabled} />
      <PerspectiveCamera makeDefault position={[0, 8, 0]} />
      <ambientLight intensity={1} />
      <Physics debug paused={props.disabled}>
        <RigidBody type="fixed" colliders="cuboid" position={[0, 0, 0]}>
          <mesh // ground
            scale={[scale, scale, scale]}
            position={[-scale / 2, -scale / 2, -scale / 2]}
            geometry={quadGeometryXZ}
          >
            <meshBasicMaterial side={THREE.DoubleSide} transparent color="blue" opacity={0.2} />
          </mesh>
        </RigidBody>
      </Physics>
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {string} testProp
 */

const scale = 20;

/**
 * @param {Pick<import('./TestCanvas').Props, 'disabled' | 'stats'>} props
 */
export default function WrappedTestCharacter(props) {
  return (
    <TestCanvas
      disabled={props.disabled}
      stats={props.stats}
      childComponent={TestCharacter}
      childProps={{ disabled: props.disabled, testProp: "hello" }}
    />
  );
}
