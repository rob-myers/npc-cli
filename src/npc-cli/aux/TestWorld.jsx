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
import NavPathHelper from "./NavPathHelper";
import TestWorldCanvas from "./TestWorldCanvas";
import TestWorldScene from "./TestWorldScene";
import { wallOutset, worldScale } from "../service/const";

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

        state.helper.navPath?.dispose();
        state.helper.navPath = new NavPathHelper();

        threeScene.add(state.helper.navPath, state.helper.navMesh, state.helper.crowd);
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
            maxAgentRadius: wallOutset * worldScale,
            navMesh: state.nav.navMesh,
          });

          state.setupDemoCrowd();

          if (!state.disabled) {
            state.timer.reset();
            state.updateCrowd();
          }
        }
      },
      setupDemoCrowd() {
        const navMeshQuery = new NavMeshQuery({ navMesh: state.nav.navMesh });

        const startPoint = { x: 3 * 1.5, y: 0, z: 5 * 1.5 };
        const endPoint = { x: 0, y: 0, z: 0 };

        const initialAgentPosition = navMeshQuery.getClosestPoint(startPoint);
        const agent = state.crowd.addAgent(initialAgentPosition, {
          radius: wallOutset * worldScale,
          height: 1.5,
          maxAcceleration: 4.0,
          maxSpeed: 1.0,
          collisionQueryRange: 0.5,
          pathOptimizationRange: 0.0,
          separationWeight: 1.0,
        });
        state.addHelpers();
        agent.goto(endPoint);

        // 🚧 depict navPath
        const path = navMeshQuery.computePath(startPoint, endPoint, {});
        state.helper.navPath.setPath(path);
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
    state.timer.reset();
    if (state.disabled) {
      cancelAnimationFrame(state.reqAnimId);
    } else {
      state.crowd && state.updateCrowd();
    }
  }, [state.disabled]);

  React.useMemo(() => {
    if (geomorphs) {
      state.geomorphs = geomorphs;
      state.map = geomorphs.map[props.mapKey];
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
    worker.postMessage({ type: "request-nav-mesh", mapKey: props.mapKey });
    return () => void worker.terminate();
  }, [
    state.threeReady,
    props.mapKey,
    // geomorphs, // HMR reload on focus hack
  ]);

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
 * @property {keyof import('static/assets/geomorphs.json')['map']} mapKey
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
 * @property {{ navMesh: NavMeshHelper; crowd: CrowdHelper; navPath: NavPathHelper }} helper
 *
 * @property {() => void} addHelpers
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureGmData
 * @property {(e: MessageEvent<WW.NavMeshResponse>) => Promise<void>} handleMessageFromWorker
 * @property {() => void} setupDemoCrowd
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
