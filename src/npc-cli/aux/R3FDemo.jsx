import React, { Suspense } from "react";
import * as THREE from "three";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Canvas } from "@react-three/fiber";
import { geomorphService } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
import { Edges, MapControls, PerspectiveCamera } from "@react-three/drei";

/**
 * React-Three-Fiber Demo
 * @param {Props} props
 */
export default function R3FDemo(props) {
  const state = useStateRef(
    /** @type {() => State} */ () => ({
      disabled: !!props.disabled,
    })
  );

  const { data: gms } = useQuery({
    queryKey: ["R3FDemo"],
    /** @returns {Promise<GeomorphData[]>} */
    async queryFn() {
      const symbolsJson = /** @type {import('static/assets/symbol/symbols-meta.json')} */ (
        await fetch(`/assets/symbol/symbols-meta.json`).then((x) => x.json())
      );
      return props.gmDefs.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }) => {
        const { pngRect } = symbolsJson[geomorphService.gmKeyToKeys(gmKey).hullKey];
        return { gmKey, transform, pngRect, debugPngPath: `/assets/debug/${gmKey}.png` };
      });
    },
    enabled: !state.disabled,
  });

  return gms ? (
    <Canvas
      gl={{
        // powerPreference: "lower-power", // 🔔 throws
        toneMapping: 4,
        toneMappingExposure: 1,
      }}
      style={{ background: "white" }}
    >
      <MapControls />
      <ambientLight intensity={1} />
      <PerspectiveCamera makeDefault position={[0, 4, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <Suspense fallback={null}>
        <Origin />
        <Geomorphs gms={gms} />
      </Suspense>
    </Canvas>
  ) : null;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.GeomorphsDefItem[]} gmDefs
 */

/**
 * @typedef State
 * @property {boolean} disabled
 */

/**
 * @typedef GeomorphData
 * @property {Geomorph.GeomorphKey} gmKey
 * @property {[number, number, number, number, number, number]} transform
 * @property {Geom.RectJson} pngRect
 * @property {string} debugPngPath
 */

function Origin() {
  return (
    <mesh scale={[0.025, 0, 0.025]} position={[0, 0.05, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
}

/**
 * @param {GeomorphsProps} props
 */
function Geomorphs(props) {
  const state = useStateRef(
    /** @type {() => GeomorphsState} */ () => ({
      ready: true,
      tex: {},

      mat4s: props.gms.map(
        (gm, gmId) =>
          new THREE.Matrix4(
            gm.transform[0],
            0,
            gm.transform[2],
            gm.transform[4] * scale,
            // 0, 1, 0, gmId * 0.000001, // hack to fix z-fighting
            0,
            1,
            0,
            0,
            gm.transform[1],
            0,
            gm.transform[3],
            gm.transform[5] * scale,
            0,
            0,
            0,
            1
          )
      ),
    })
  );

  const results = useQueries({
    queries: props.gms.map((gm) => ({
      queryKey: ["R3FDemo", gm.gmKey],
      queryFn: () => textureLoader.loadAsync(gm.debugPngPath),
    })),
  });
  props.gms.forEach((gm, gmId) => (state.tex[gm.gmKey] ??= results[gmId].data));

  return (
    <>
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
    </>
  );
}

/**
 * @typedef GeomorphsProps
 * @property {GeomorphData[]} gms
 */

/**
 * @typedef GeomorphsState
 * @property {boolean} ready
 * @property {Partial<Record<Geomorph.GeomorphKey, THREE.Texture>>} tex
 * @property {THREE.Matrix4[]} mat4s
 */

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
