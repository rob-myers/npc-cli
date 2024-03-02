
import React from "react";
import { useQueries } from "@tanstack/react-query";

import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { MapControls, PerspectiveCamera } from "@react-three/drei";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {SceneProps} props
 */
export default function Scene(props) {

  const state = useStateRef(/** @type {() => SceneState} */() => ({
    ready: true,
    tex: {},
    mat4s: props.gms.map((gm, gmId) =>
      new THREE.Matrix4(
        gm.transform[0], 0, gm.transform[2], gm.transform[4] * scale,
        0, 1, 0, gmId * 0.0001, // hack to fix z-fighting
        // 0, 1, 0, 0,
        gm.transform[1], 0, gm.transform[3], gm.transform[5] * scale,
        0, 0, 0, 1
      )
    ),
    controls: /** @type {*} */ (null),
  }));

  state.controls = useThree((state) => /** @type {SceneState['controls']} */(state.controls));

  React.useEffect(() => {
    state.controls?.setPolarAngle(Math.PI / 4);
  }, [state.controls]);

  useQueries({
    queries: props.gms.map((gm) => ({
      queryKey: ["R3FDemo", gm.gmKey],
      queryFn: () => textureLoader.loadAsync(gm.debugPngPath),
    })),
    combine(results) {
      props.gms.forEach((gm, gmId) => (state.tex[gm.gmKey] ??= results[gmId].data));
      return results;
    },
  });

  return (
    <>
      <MapControls makeDefault zoomToCursor />
      <ambientLight intensity={1} />
      <PerspectiveCamera position={[0, 8, 0]} makeDefault />
      <Origin />
      {props.gms.map((gm, gmId) => (
        <group key={gmId} onUpdate={(self) => self.applyMatrix4(state.mat4s[gmId])}>
          {state.tex[gm.gmKey] && (
            <mesh
              scale={[gm.pngRect.width * scale, 1, gm.pngRect.height * scale]}
              geometry={customQuadGeometry}
              position={[gm.pngRect.x * scale, 0, gm.pngRect.y * scale]}
            >
              <meshStandardMaterial
                transparent
                // toneMapped
                // color="#999"
                // toneMapped={false}
                map={state.tex[gm.gmKey]}
              // emissive={new THREE.Color(0.1, 0.1, 0.1)}
              // Improves look, but causes issue with hull overlap
              // 🚧 try simulating in geomorph-render instead
              // alphaMap={state.tex[gm.gmKey]}
              />
              {/* <Edges
                // scale={1.1}
                scale={1}
                threshold={15} // degrees
                color="red"
              /> */}
            </mesh>
          )}
        </group>
      ))}
      {/* <Stats showPanel={0} /> */}
    </>
  );
}

/**
 * @typedef SceneProps
 * @property {import('./R3FDemo').GeomorphData[]} gms
*/

/**
 * @typedef SceneState
 * @property {boolean} ready
 * @property {Partial<Record<Geomorph.GeomorphKey, THREE.Texture>>} tex
 * @property {THREE.Matrix4[]} mat4s
 * @property {import('three-stdlib').MapControls} controls
 */

function Origin() {
  return (
    <mesh scale={[0.025, 0, 0.025]} position={[0, 0.05, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
}

const gmScale = 1;
/**
 * - Undo image scale (i.e. `gmScale`).
 * - Next, `1/60` -> 1 grid side -> `1.5m`
 */
const scale = (1 / gmScale) * (1 / 60) * (2 / 3);

const textureLoader = new THREE.TextureLoader();

export const customQuadGeometry = new THREE.BufferGeometry();
const vertices = new Float32Array([0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1]);

const uvs = new Float32Array([0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0]);

const indices = [0, 1, 2, 0, 3, 1];
customQuadGeometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
customQuadGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
customQuadGeometry.setIndex(indices);
