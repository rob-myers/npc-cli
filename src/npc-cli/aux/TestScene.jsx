import React from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Edges } from "@react-three/drei";
import useStateRef from "../hooks/use-state-ref";
import { geomorphService } from "../service/geomorph";
import { customQuadGeometry } from "../service/three";

/**
 * @param {Props} props
 */
export default function TestScene(props) {
  const state = useStateRef(
    /** @type {() => SceneState} */ () => ({
      ready: true,
      tex: {},
      mat4s: props.gmDefs.map(
        ({ transform = [1, 0, 0, 1, 0, 0] }) =>
          new THREE.Matrix4(
            transform[0],
            0,
            transform[2],
            transform[4] * scale,
            // 0, 1, 0, gmId * 0.001, // hack to fix z-fighting
            0,
            1,
            0,
            0,
            transform[1],
            0,
            transform[3],
            transform[5] * scale,
            0,
            0,
            0,
            1
          )
      ),
      controls: /** @type {*} */ (null),
    })
  );

  state.controls = useThree((state) => /** @type {SceneState['controls']} */ (state.controls));

  React.useEffect(() => {
    state.controls?.setPolarAngle(Math.PI / 4);
  }, [state.controls]);

  const { data: gms = [] } = useQuery({
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
    enabled: !props.disabled, // 🚧 what happens to `data` when goes disabled?
  });

  useQueries({
    queries:
      gms.map((gm) => ({
        queryKey: ["R3FDemo", gm.gmKey],
        queryFn: () => textureLoader.loadAsync(gm.debugPngPath),
      })) ?? [],
    combine(results) {
      gms.forEach((gm, gmId) => (state.tex[gm.gmKey] ??= results[gmId].data));
      return results;
    },
  });

  return (
    <>
      <MapControls makeDefault zoomToCursor />
      <ambientLight intensity={1} />
      <PerspectiveCamera position={[0, 8, 0]} makeDefault />
      <Origin />
      {gms.map((gm, gmId) => (
        <group key={gmId} onUpdate={(self) => self.applyMatrix4(state.mat4s[gmId])}>
          {state.tex[gm.gmKey] && (
            <mesh
              scale={[gm.pngRect.width * scale, 1, gm.pngRect.height * scale]}
              geometry={customQuadGeometry}
              position={[gm.pngRect.x * scale, 0, gm.pngRect.y * scale]}
            >
              <meshBasicMaterial
                side={THREE.DoubleSide}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                map={state.tex[gm.gmKey]}
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
      <gridHelper
        args={[200, 200 * (3 / 2)]}
        onPointerUp={(e) => {
          e.stopPropagation();
          console.log("gridHelper onPointerUp", e);
        }}
      />
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.GeomorphsDefItem[]} gmDefs
 */

/**
 * @typedef SceneState
 * @property {boolean} ready
 * @property {Partial<Record<Geomorph.GeomorphKey, THREE.Texture>>} tex
 * @property {THREE.Matrix4[]} mat4s
 * @property {import('three-stdlib').MapControls} controls
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
    <mesh scale={[0.025, 0, 0.025]} position={[0, 0, 0]}>
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
