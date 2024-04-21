import React from "react";
import * as THREE from "three";
import { MapControls, PerspectiveCamera } from "@react-three/drei";
import { quadGeometryXZ } from "../service/three";

import useStateRef from "../hooks/use-state-ref";
import TestCanvas from "./TestCanvas";
import { TestCharacterController } from "./TestCharacterController";

/**
 * @param {Props} props
 */
export function TestCharacter(props) {

  const state = useStateRef(/** @returns {State} */ () => ({
    controller: /** @type {*} */ (null),
  }));

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

        <TestCharacterController
          ref={x => x && (state.controller = x)}
        />

        <mesh
          name="ground"
          scale={[groundScale, 1, groundScale]}
          position={[-groundScale / 2, 0, -groundScale / 2]}
          geometry={quadGeometryXZ}
          receiveShadow
          onClick={e => {
            const { characterController } = state.controller;
            characterController.setTarget(e.point);
            characterController.shouldRun = e.shiftKey;
          }}
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

/**
 * @typedef State
 * @property {import('./TestCharacterController').State} controller
 */

const groundScale = 20;

/**
 * @param {Pick<import('./TestCanvas').Props, 'disabled' | 'stats'>} props
 */
export default function WrappedTestCharacter(props) {
  return (
    <TestCanvas
      disabled={props.disabled}
      stats={props.stats}
      childComponent={TestCharacter}
      childProps={{
        disabled: props.disabled,
      }}
      shadows
    />
  );
}
