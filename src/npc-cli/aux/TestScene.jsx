import React from "react";
import { useQuery } from "@tanstack/react-query";

import * as THREE from "three";
import { MapControls, PerspectiveCamera, Edges } from "@react-three/drei";

import { ASSETS_META_JSON_FILENAME } from "src/scripts/const";
import { Poly, Rect } from "../geom";
import { geomorphService } from "../service/geomorph";
import { quadGeometryXZ } from "../service/three";
import { assertDefined, assertNonNull, isDevelopment } from "../service/generic";
import { drawPolygons } from "../service/dom";

import "./infinite-grid-helper.js";
import { TestCanvasContext } from "./test-canvas-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import TestGeomorphs from "./TestGeomorphs";
import { Origin } from "./MiscThree";

import TestCanvas from "./TestCanvas";

// 🚧 remove geomorphs (now in TestWorldScene)

/**
 * @param {Props} props
 */
export function TestScene(props) {
  const state = useStateRef(
    /** @type {() => State} */ () => ({
      controls: /** @type {*} */ (null),
      layout: {},
      gms: [],
      map: null,
      canvas: {},
      canvasTex: {},
      drawGeomorph(gmKey, origImg, assetsJson) {
        const layout = assertDefined(state.layout[gmKey]);
        const canvas = assertDefined(state.canvas[gmKey]);
        const ctxt = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

        ctxt.drawImage(origImg, 0, 0);
        const bounds = new Rect(0, 0, layout.pngRect.width, layout.pngRect.height);
        // prettier-ignore
        const extHull = new Poly(bounds.points, [bounds.clone().inset(6.5 + 6.5).points.reverse()]);

        ctxt.fillStyle = "green";
        ctxt.strokeStyle = "red";
        ctxt.lineWidth = 4;
        // fix z-fighting
        drawPolygons(ctxt, [extHull]);
        // 🚧 draw hull doors
        const { hullKey } = geomorphService.gmKeyToKeys(gmKey);
        console.log("doors", assetsJson.symbols[hullKey].doors);

        // ctxt.strokeRect(0, 0, bounds.width, bounds.height);
        // 🚧 draw floor polygon
      },
    })
  );

  const api = /** @type {Api} */ (React.useContext(TestCanvasContext));
  api.scene = state;

  const { data: assets } = useQuery({
    queryKey: [ASSETS_META_JSON_FILENAME],
    /** @returns {Promise<Geomorph.Assets>} */
    queryFn: () =>
      fetch(`/assets/${ASSETS_META_JSON_FILENAME}`)
        .then((x) => x.json())
        .then(geomorphService.deserializeAssets),
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
  });

  React.useLayoutEffect(() => {
    state.map = assets?.maps[props.mapKey] ?? null;

    state.map?.gms.forEach(({ gmKey }) => {
      const canvas = (state.canvas[gmKey] ??= document.createElement("canvas"));
      state.canvasTex[gmKey] ??= new THREE.CanvasTexture(canvas);
    });

    assets &&
      state.map?.gms.forEach(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }, gmId) => {
        let layout = (state.layout[gmKey] ??= geomorphService.computeLayout(gmKey, assets));
        // 🚧 recompute layout if hash changes
        // 🚧 need assetsJson.meta[gmKey] (determined by hull and sub-symbols)
        // if (false) {
        //   layout = state.layout[gmKey] = geomorphService.computeLayout(gmKey, assetsJson);
        // }

        // 🔔 MUST set width, height BEFORE <mesh> with <canvasTexture> mounts
        const canvas = assertDefined(state.canvas[gmKey]);
        canvas.width = layout.pngRect.width;
        canvas.height = layout.pngRect.height;

        state.gms[gmId] = {
          ...layout,
          gmId,
          transform,
          mat4: // prettier-ignore
            new THREE.Matrix4(
              transform[0], 0, transform[2], transform[4] * scale,
              0, 1, 0, 0,
              transform[1], 0, transform[3], transform[5] * scale,
              0, 0, 0, 1
            ),
        };

        textureLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((tex) => {
          const img = /** @type {HTMLImageElement} */ (tex.source.data);
          state.drawGeomorph(gmKey, img, assets);
          assertDefined(state.canvasTex[gmKey]).needsUpdate = true;
          update();
        });
      });

    // update();
  }, [assets, props.mapKey]);

  React.useEffect(() => {
    // 🚧 do not trigger on HMR
    state.controls?.setPolarAngle(Math.PI / 4); // Initialize view
  }, [state.controls]);

  const update = useUpdate();

  return (
    <>
      <MapControls makeDefault zoomToCursor ref={(x) => x && (state.controls = x)} />
      <ambientLight intensity={1} />
      <PerspectiveCamera position={[0, 8, 0]} makeDefault />
      <Origin />

      {state.gms.map((gm, gmId) => (
        <group key={gm.transform.toString()} onUpdate={(self) => self.applyMatrix4(gm.mat4)}>
          <mesh
            scale={[gm.pngRect.width * scale, 1, gm.pngRect.height * scale]}
            geometry={quadGeometryXZ}
            position={[gm.pngRect.x * scale, 0, gm.pngRect.y * scale]}
          >
            <meshBasicMaterial
              side={THREE.DoubleSide}
              transparent
              map={state.canvasTex[gm.key]}
            ></meshBasicMaterial>
          </mesh>
        </group>
      ))}

      <TestGeomorphs disabled={props.disabled} />

      <infiniteGridHelper
        args={[1.5, 1.5, "#bbbbbb"]}
        // position={[0, -0.001, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerUp={(e) => {
          if (!api.down) {
            return;
          }
          console.log("infiniteGridHelper onPointerUp", e, e.point);
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
 * @property {string} mapKey
 */

/**
 * @typedef State
 * @property {import('three-stdlib').MapControls} controls
 * @property {{ [key in Geomorph.GeomorphKey]?: Geomorph.Layout}} layout
 * @property {Geomorph.LayoutInstance[]} gms
 * @property {null | Geomorph.MapDef} map
 * @property {{ [key in Geomorph.GeomorphKey]?: HTMLCanvasElement }} canvas
 * @property {{ [key in Geomorph.GeomorphKey]?: THREE.CanvasTexture }} canvasTex
 * @property {(gmKey: Geomorph.GeomorphKey, origImg: HTMLImageElement, assets: Geomorph.Assets) => void} drawGeomorph
 */

/**
 * @typedef {import('./TestCanvas').State<{ scene: State }>} Api
 */

const gmScale = 1;
/**
 * - Undo image scale (i.e. `gmScale`).
 * - Next, `1/60` -> 1 grid side -> `1.5m`
 */
const scale = (1 / gmScale) * (1 / 60) * 1.5;

const textureLoader = new THREE.TextureLoader();

/**
 * @param {Pick<import('./TestCanvas').Props, 'disabled' | 'stats'>} props
 */
export default function WrappedTestScene(props) {
  return (
    <TestCanvas
      disabled={props.disabled}
      stats={props.stats}
      childComponent={TestScene}
      childProps={{ disabled: props.disabled, mapKey: "demo-map-1" }}
    />
  );
}
