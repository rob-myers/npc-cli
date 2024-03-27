import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd, NavMeshQuery } from "@recast-navigation/core";
import { NavMeshHelper, CrowdHelper } from "@recast-navigation/three";
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
      disabled: !!props.disabled,
      events: new Subject(),
      geomorphs: /** @type {*} */ (null),
      map: /** @type {*} */ (null),
      gmData: /** @type {*} */ ({}),
      gms: [],

      threeReady: false,
      reqAnimId: 0,
      timer: new Timer(),
      nav: /** @type {*} */ (null),
      crowd: /** @type {*} */ (null),
      helper: /** @type {*} */ ({}),
      view: /** @type {*} */ (null), // TestWorldCanvas state
      scene: /** @type {*} */ ({}), // TestWorldScene state

      addHelpers() {
        const threeScene = state.view.rootState.scene;

        state.helper.navMesh?.removeFromParent();
        state.helper.crowd?.removeFromParent();
        state.helper.navMesh = new NavMeshHelper({
          navMesh: state.nav.navMesh,
          navMeshMaterial: wireFrameMaterial,
        });
        state.helper.crowd = new CrowdHelper({ crowd: state.crowd, agentMaterial: undefined });

        state.helper.navMesh.position.y = 0.01;

        threeScene.add(state.helper.navMesh, state.helper.crowd);
      },
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
        // fix normals for recast/detour... maybe due to earcut ordering?
        gmData.debugNavPoly = polysToXZGeometry(layout.navPolys, { reverse: true });
        return gmData;
      },
      async handleMessageFromWorker(e) {
        const msg = e.data;
        info("main thread received message", msg);
        if (msg.type === "nav-mesh-response") {
          await initRecastNav();
          const tileCacheMeshProcess = createDefaultTileCacheMeshProcess();
          state.nav = /** @type {TiledCacheResult} */ (
            importNavMesh(msg.exportedNavMesh, tileCacheMeshProcess)
          );

          state.crowd?.destroy();
          state.crowd = new Crowd({
            maxAgents: 10,
            maxAgentRadius: 0.6,
            navMesh: state.nav.navMesh,
          });

          // 🚧 move an agent
          const navMeshQuery = new NavMeshQuery({ navMesh: state.nav.navMesh });
          const initialAgentPosition = navMeshQuery.getClosestPoint({
            x: 3 * 1.5,
            y: 0,
            z: 5 * 1.5,
          });
          const agent = state.crowd.addAgent(initialAgentPosition, {
            radius: 0.5,
            height: 1.5,
            maxAcceleration: 4.0,
            maxSpeed: 1.0,
            collisionQueryRange: 0.5,
            pathOptimizationRange: 0.0,
            separationWeight: 1.0,
          });
          state.addHelpers();

          if (!state.disabled) {
            state.timer.reset();
            state.updateCrowd();
          }

          agent.goto({ x: 0, y: 0, z: 0 });
        }
      },
      update,
      updateCrowd() {
        state.reqAnimId = requestAnimationFrame(state.updateCrowd);
        state.timer.update();
        const deltaMs = state.timer.getDelta();
        state.crowd.update(deltaMs);
        state.helper.crowd.update();
      },
    })
  );

  state.disabled = !!props.disabled;

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
    if (state.disabled) {
      cancelAnimationFrame(state.reqAnimId);
    } else {
      state.timer.reset();
      state.crowd && state.updateCrowd();
    }
  }, [state.disabled]);

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
    worker.addEventListener("message", state.handleMessageFromWorker);
    worker.postMessage({ type: "request-nav-mesh", mapKey: state.map.key });
    return () => void worker.terminate();
  }, [state.threeReady, state.map, geomorphs]); // 🚧 reload on focus in development should be optional

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
 * @property {boolean} disabled
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {Geomorph.MapDef} map
 * @property {number} reqAnimId
 * @property {boolean} threeReady
 * @property {import('./TestWorldCanvas').State} view
 * @property {import('./TestWorldScene').State} scene
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmData
 * Only populated for geomorphs seen in some map.
 * @property {Geomorph.LayoutInstance[]} gms Aligned to `map.gms`.
 * @property {Timer} timer
 * @property {TiledCacheResult} nav
 * @property {Crowd} crowd
 * @property {{ navMesh: NavMeshHelper; crowd: CrowdHelper; }} helper
 *
 * @property {() => void} addHelpers
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureGmData
 * @property {(e: MessageEvent<WW.NavMeshResponse>) => Promise<void>} handleMessageFromWorker
 * @property {() => void} update
 * @property {() => void} updateCrowd
 */

/**
 * @typedef GmData
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctxt
 * @property {Geomorph.Layout} layout
 * @property {THREE.BufferGeometry} debugNavPoly
 * @property {THREE.CanvasTexture} tex
 */

/**
 * @typedef {Extract<ReturnType<typeof importNavMesh>, { tileCache?: any }>} TiledCacheResult
 */
