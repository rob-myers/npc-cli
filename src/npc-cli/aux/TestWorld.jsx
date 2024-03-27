import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";
import { importNavMesh, init as initRecastNav } from "@recast-navigation/core";
import { NavMeshHelper } from "@recast-navigation/three";
import { createDefaultTileCacheMeshProcess } from "@recast-navigation/generators";

import { GEOMORPHS_JSON_FILENAME } from "src/scripts/const";
import { assertNonNull, info, isDevelopment } from "../service/generic";
import { geomorphService } from "../service/geomorph";
import { polysToXZGeometry, tmpBufferGeom1, wireFrameMaterial } from "../service/three";
import { TestWorldContext } from "./test-world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import TestWorldCanvas from "./TestWorldCanvas";
import TestWorldScene from "./TestWorldScene";

/**
 * @param {Props} props
 */
export default function TestWorld(props) {
  const update = useUpdate();

  const state = useStateRef(
    /** @returns {State} */ () => ({
      events: new Subject(),
      geomorphs: /** @type {*} */ (null),
      map: /** @type {*} */ (null),
      gmData: /** @type {*} */ ({}),
      gms: [],
      nav: {}, // 🚧

      threeReady: false,
      view: /** @type {*} */ (null), // TestWorldCanvas state
      scene: /** @type {*} */ ({}), // TestWorldScene state

      ensureGmData(gmKey) {
        const layout = state.geomorphs.layout[gmKey];
        let gmData = state.gmData[gmKey];
        if (!gmData) {
          const canvas = document.createElement("canvas");
          canvas.width = layout.pngRect.width;
          canvas.height = layout.pngRect.height;
          gmData = state.gmData[gmKey] = {
            canvas,
            ctxt: assertNonNull(canvas.getContext("2d")),
            layout,
            tex: new THREE.CanvasTexture(canvas),
            debugNavPoly: tmpBufferGeom1,
          };
        }
        gmData.layout = layout;
        // 🔔 fix normals for recast/detour
        gmData.debugNavPoly = polysToXZGeometry(layout.navPolys, { reverse: true });
        return gmData;
      },

      update,
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
      state.gms = state.map.gms.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }, gmId) =>
        geomorphService.computeLayoutInstance(state.ensureGmData(gmKey).layout, gmId, transform)
      );

      state.scene.wallsKey = state.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
      state.scene.doorsKey = state.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
    }
  }, [geomorphs, props.mapKey]);

  React.useEffect(() => {
    if (!state.threeReady) {
      return;
    }
    // 🔔 strange behaviour when inlined `new URL`.
    // 🔔 assume worker already listening for events
    /** @type {WW.WorkerGeneric<WW.MessageToWorker, WW.MessageFromWorker>}  */
    const worker = new Worker(new URL("./test-recast.worker", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", async (e) => {
      const msg = e.data;
      info("main thread received message", msg);
      if (msg.type === "nav-mesh-response") {
        await initRecastNav();
        const tileCacheMeshProcess = createDefaultTileCacheMeshProcess();
        const imported =
          /** @type {Extract<ReturnType<typeof importNavMesh>, { tileCache?: any }>} */ (
            importNavMesh(msg.exportedNavMesh, tileCacheMeshProcess)
          );

        // add navMesh helper to scene
        const threeScene = state.view.rootState.scene;
        const navMeshHelper = new NavMeshHelper({
          navMesh: imported.navMesh,
          navMeshMaterial: wireFrameMaterial,
        });
        navMeshHelper.name = "NavMeshHelper";
        navMeshHelper.position.y = 0.01;
        threeScene.getObjectByName(navMeshHelper.name)?.removeFromParent();
        threeScene.add(navMeshHelper);
      }
    });
    worker.postMessage({ type: "request-nav-mesh", mapKey: state.map.key });
    return () => void worker.terminate();
  }, [state.threeReady, state.map]); // 🚧 reload on focus in development should be optional

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
 * @property {boolean} threeReady
 * @property {import('./TestWorldCanvas').State} view
 * @property {import('./TestWorldScene').State} scene
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmData
 * Only populated for geomorphs seen in some map.
 * @property {Geomorph.LayoutInstance[]} gms Aligned to `map.gms`.
 * @property {{}} nav
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureGmData
 * @property {() => void} update
 */

/**
 * @typedef GmData
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctxt
 * @property {Geomorph.Layout} layout
 * @property {THREE.BufferGeometry} debugNavPoly
 * @property {THREE.CanvasTexture} tex
 */
