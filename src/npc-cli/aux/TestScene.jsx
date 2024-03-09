import React from "react";
import { useQuery } from "@tanstack/react-query";

import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Edges } from "@react-three/drei";

import { geomorphService } from "../service/geomorph";
import { customQuadGeometry } from "../service/three";
import "./infinite-grid-helper.js";
import { TestCanvasContext } from "./test-canvas-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

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
          // prettier-ignore
          new THREE.Matrix4(
            transform[0], 0, transform[2], transform[4] * scale,
            0, 1, 0, 0,
            transform[1], 0, transform[3], transform[5] * scale,
            0, 0, 0, 1
          )
      ),
      controls: /** @type {*} */ (null),
    })
  );

  // Initialize view
  state.controls = useThree((state) => /** @type {SceneState['controls']} */ (state.controls));
  React.useEffect(() => {
    state.controls?.setPolarAngle(Math.PI / 4);
  }, [state.controls]);

  const api = React.useContext(TestCanvasContext);

  // gmDefs -> gms; load textures
  const { data: gms = [] } = useQuery({
    queryKey: ["R3FDemo"],
    /** @returns {Promise<GeomorphData[]>} */
    async queryFn() {
      props.gmDefs.forEach(async ({ gmKey }) => {
        state.tex[gmKey] ??= await textureLoader.loadAsync(`/assets/debug/${gmKey}.png`);
        update();
      });
      const symbolsJson = /** @type {import('static/assets/assets-meta.json')} */ (
        await fetch(`/assets/assets-meta.json`).then((x) => x.json())
      ).symbols;
      return props.gmDefs.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }) => {
        const { pngRect } = symbolsJson[geomorphService.gmKeyToKeys(gmKey).hullKey];
        return { gmKey, transform, pngRect, debugPngPath: `/assets/debug/${gmKey}.png` };
      });
    },
    enabled: !props.disabled,
  });

  const update = useUpdate();

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
                // 🚧 remove blending, depthWrite
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                map={state.tex[gm.gmKey]}
              />
            </mesh>
          )}
        </group>
      ))}
      <infiniteGridHelper
        args={[1.5, 1.5, "#bbbbbb"]}
        // position={[0, -0.001, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerUp={(e) => {
          if (!api.down) {
            return;
          }
          console.log("TestScene onPointerUp", e, e.point);
          const distance = api.down.clientPos.distanceTo({ x: e.clientX, y: e.clientY });
          const timeMs = Date.now() - api.down.epochMs;
          api.events.next({
            key: "pointerup",
            distance,
            height: e.point.y,
            longPress: timeMs >= 300,
            point: { x: e.point.x, y: e.point.z },
            rmb: e.button === 2,
            // 🤔 or clientX,Y minus canvas bounds?
            screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
            meta: {
              floor: true,
              targetCenter: undefined,
            },
          });
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
const scale = (1 / gmScale) * (1 / 60) * 1.5;

const textureLoader = new THREE.TextureLoader();
