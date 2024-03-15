import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";

import { assertNonNull, isDevelopment } from "../service/generic";
import { worldScale } from "../service/const";
import { geomorphService } from "../service/geomorph";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import TestWorldCanvas from "./TestWorldCanvas";
import TestWorldScene from "./TestWorldScene";

/**
 * @param {Props} props
 */
export default function TestWorld(props) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      events: new Subject(),
      assets: /** @type {*} */ (null),
      map: null,
      gmData: /** @type {*} */ ({}),
      gms: [],
      scene: /** @type {*} */ (null),
      view: /** @type {*} */ (null),
      ensureClass(gmKey) {
        const { assets } = state;
        if (!state.gmData[gmKey]) {
          const canvas = document.createElement("canvas");
          const layout = geomorphService.computeLayout(gmKey, assets);
          canvas.width = layout.pngRect.width;
          canvas.height = layout.pngRect.height;
          state.gmData[gmKey] = {
            canvas,
            ctxt: assertNonNull(canvas.getContext("2d")),
            layout,
            tex: new THREE.CanvasTexture(canvas),
          };
        } else if (state.gmData[gmKey].layout.lastModified !== assets.meta[gmKey].lastModified) {
          state.gmData[gmKey].layout = geomorphService.computeLayout(gmKey, assets);
        }
        return state.gmData[gmKey];
      },
    })
  );

  const { data: assets } = useQuery({
    queryKey: ["assets-meta.json"],
    queryFn: async () => {
      /** @type {Geomorph.AssetsJson} */
      const json = await fetch("/assets/assets-meta.json").then((x) => x.json());
      return geomorphService.deserializeAssets(json);
    },
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
  });

  if (assets) {
    state.assets = assets;
    state.map = assets.maps[props.mapKey ?? ""] ?? null;
  }

  React.useMemo(() => {
    if (assets && state.map) {
      state.gms = state.map.gms.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }, gmId) => {
        const { layout } = state.ensureClass(gmKey);
        return {
          ...layout,
          gmId,
          transform,
          mat4: // prettier-ignore
            new THREE.Matrix4(
              transform[0], 0, transform[2], transform[4] * worldScale,
              0, 1, 0, 0,
              transform[1], 0, transform[3], transform[5] * worldScale,
              0, 0, 0, 1
            ),
        };
      });
    }
  }, [assets, state.map]);

  return (
    <TestWorldContext.Provider value={state}>
      <TestWorldCanvas disabled={props.disabled} stats>
        {state.map && <TestWorldScene disabled={props.disabled} />}
      </TestWorldCanvas>
    </TestWorldContext.Provider>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {string} [mapKey]
 */

/**
 * @typedef State
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Assets} assets
 * @property {Geomorph.MapDef | null} map
 * @property {import('./TestWorldScene').State} scene
 * @property {import('./TestWorldCanvas').State} view
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmData
 * Only populated for geomorphs seen in some map.
 * @property {Geomorph.LayoutInstance[]} gms Aligned to `map.gms`.
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureClass
 */

/**
 * @typedef GmData
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctxt
 * @property {Geomorph.Layout} layout
 * @property {THREE.CanvasTexture} tex
 */
