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
import Ecctrl from "ecctrl";
import { quadGeometryXZ } from "../service/three";

import TestCanvas from "./TestCanvas";

/**
 * @param {Props} props
 */
export function TestCharacter(props) {
  // console.log("TestCharacter received props", props);

  return (
    <>
      {/* <MapControls makeDefault zoomToCursor position={[0, 8, 0]} /> */}
      <CameraControls makeDefault enabled={!props.disabled} />
      <PerspectiveCamera makeDefault position={[0, 8, 0]} />
      <ambientLight intensity={1} />
      <Physics debug paused={props.disabled}>
        <KeyboardControls map={keyboardMap}>
          <Ecctrl>
            <capsuleGeometry args={[0.3, 0.7]} />
          </Ecctrl>
        </KeyboardControls>

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

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["Shift"] },
  // Optional animation key map
  { name: "action1", keys: ["1"] },
  { name: "action2", keys: ["2"] },
  { name: "action3", keys: ["3"] },
  { name: "action4", keys: ["KeyF"] },
];

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
