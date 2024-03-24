import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";

import { GEOMORPHS_JSON_FILENAME } from "src/scripts/const";
import { assertNonNull, isDevelopment } from "../service/generic";
import { geomorphService } from "../service/geomorph";
import { polysToXZGeometry } from "../service/three";
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
      geomorphs: /** @type {*} */ (null),
      map: /** @type {*} */ (null),
      gmData: /** @type {*} */ ({}),
      gms: [],
      scene: /** @type {*} */ ({}),
      view: /** @type {*} */ (null),

      ensureGmData(gmKey) {
        const { geomorphs } = state;
        if (!state.gmData[gmKey]) {
          const canvas = document.createElement("canvas");
          const layout = geomorphs.layout[gmKey];
          canvas.width = layout.pngRect.width;
          canvas.height = layout.pngRect.height;
          state.gmData[gmKey] = {
            canvas,
            ctxt: assertNonNull(canvas.getContext("2d")),
            layout,
            tex: new THREE.CanvasTexture(canvas),
            debugNavPoly: polysToXZGeometry(layout.navPolys),
          };
        }
      },
    })
  );

  const { data: geomorphs } = useQuery({
    queryKey: [GEOMORPHS_JSON_FILENAME],
    queryFn: async () => {
      /** @type {Geomorph.GeomorphsJson} */
      const json = await fetch(`/assets/${GEOMORPHS_JSON_FILENAME}`).then((x) => x.json());
      return geomorphService.deserializeGeomorphs(json);
    },
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
    throwOnError: true,
  });

  React.useMemo(() => {
    if (geomorphs) {
      state.geomorphs = geomorphs;
      state.map = geomorphs.map[props.mapKey ?? "demo-map-1"];

      // 🚧 clean
      state.gms = state.map.gms.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }, gmId) => {
        state.ensureGmData(gmKey);
        const layout = geomorphs.layout[gmKey];
        state.gmData[gmKey].layout = layout; // update on HMR
        return geomorphService.computeLayoutInstance(layout, gmId, transform);
      });

      state.scene.wallsKey = state.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
      state.scene.doorsKey = state.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
    }
  }, [geomorphs, props.mapKey]);

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
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {Geomorph.MapDef} map
 * @property {import('./TestWorldScene').State} scene
 * @property {import('./TestWorldCanvas').State} view
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmData
 * Only populated for geomorphs seen in some map.
 * @property {Geomorph.LayoutInstance[]} gms Aligned to `map.gms`.
 * @property {(gmKey: Geomorph.GeomorphKey) => void} ensureGmData
 */

/**
 * @typedef GmData
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctxt
 * @property {Geomorph.Layout} layout
 * @property {THREE.BufferGeometry} debugNavPoly
 * @property {THREE.CanvasTexture} tex
 */
