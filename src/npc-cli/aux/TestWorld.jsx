import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd, NavMeshQuery } from "@recast-navigation/core";
import { NavMeshHelper, CrowdHelper } from "@recast-navigation/three";
import { createDefaultTileCacheMeshProcess } from "@recast-navigation/generators";

import { GEOMORPHS_JSON_FILENAME } from "src/scripts/const";
import { wallOutset, worldScale } from "../service/const";
import { assertNonNull, info, isDevelopment } from "../service/generic";
import { geomorphService } from "../service/geomorph";
import { polysToXZGeometry, tmpBufferGeom1, wireFrameMaterial } from "../service/three";
import { TestWorldContext } from "./test-world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useHandleEvents from "./use-test-handle-events";
import NavPathHelper from "./NavPathHelper";
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
      mapKey: props.mapKey,
      mapHash: 0,
      layoutsHash: 0,
      threeReady: false,
      reqAnimId: 0,
      timer: new Timer(),

      events: new Subject(),
      geomorphs: /** @type {*} */ (null),
      gmData: /** @type {*} */ ({}),
      gms: [],

      nav: /** @type {*} */ (null),
      crowd: /** @type {*} */ (null),
      agents: [],
      help: /** @type {*} */ ({}),
      view: /** @type {*} */ (null), // TestWorldCanvas state
      scene: /** @type {*} */ ({}), // TestWorldScene state

      addHelpers() {
        const threeScene = state.view.rootState.scene;
        Object.values(state.help).map((x) => x?.removeFromParent());

        state.help.navMesh = new NavMeshHelper({
          navMesh: state.nav.navMesh,
          navMeshMaterial: wireFrameMaterial,
        });
        state.help.crowd = new CrowdHelper({ crowd: state.crowd, agentMaterial: undefined });

        state.help.navMesh.position.y = 0.01;

        state.help.navPath?.dispose();
        state.help.navPath = new NavPathHelper();

        threeScene.add(state.help.navPath, state.help.navMesh, state.help.crowd);
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
          state.loadTiledMesh(msg.exportedNavMesh);
        }
      },
      loadTiledMesh(exportedNavMesh) {
        const tcmProcess = createDefaultTileCacheMeshProcess();
        const result = /** @type {TiledCacheResult} */ (importNavMesh(exportedNavMesh, tcmProcess));
        state.nav = Object.assign(result, {
          query: new NavMeshQuery({ navMesh: result.navMesh }),
        });

        if (state.crowd) {
          state.agents.forEach((x) => state.crowd.removeAgent(x));
          state.agents.length = 0;
          state.crowd.destroy();
          cancelAnimationFrame(state.reqAnimId);
        }
        state.crowd = new Crowd({
          maxAgents: 10,
          maxAgentRadius: wallOutset * worldScale,
          navMesh: state.nav.navMesh,
        });

        state.addHelpers();
        state.setupDemoCrowd();

        if (!state.disabled) {
          state.timer.reset();
          state.updateCrowd();
        }
      },
      setupDemoCrowd() {
        const { query } = state.nav;

        const src = query.getClosestPoint({ x: 3 * 1.5, y: 0, z: 5 * 1.5 });
        const dst = query.getClosestPoint({ x: 5 * 1.5, y: 0, z: 9 * 1.5 });

        const agent = state.crowd.addAgent(src, {
          radius: wallOutset * worldScale,
          height: 1.5,
          maxAcceleration: 4,
          maxSpeed: 2,
          collisionQueryRange: 0.3,
          pathOptimizationRange: 0,
          separationWeight: 1,
        });
        state.agents.push(agent);

        state.walkTo(dst);
      },
      update,
      updateCrowd() {
        state.reqAnimId = requestAnimationFrame(state.updateCrowd);
        state.timer.update();
        const deltaMs = state.timer.getDelta();
        state.crowd.update(deltaMs);
        state.help.crowd.update();
      },
      walkTo(dst) {
        const [agent] = state.agents;
        const src = agent.position();
        // debug path
        const path = state.crowd.navMeshQuery.computePath(src, dst, {});
        state.help.navPath.setPath(path);
        agent.goto(dst); // navigate
      },
    })
  );

  state.disabled = !!props.disabled;
  state.mapKey = props.mapKey;

  useHandleEvents(state);

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
      const map = geomorphs.map[props.mapKey];
      state.gms = map.gms.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }, gmId) =>
        geomorphService.computeLayoutInstance(state.ensureGmData(gmKey).layout, gmId, transform)
      );
      state.mapHash = geomorphs.mapsHash;
      state.layoutsHash = geomorphs.layoutsHash;

      state.scene.wallsKey = state.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
      state.scene.doorsKey = state.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
    }
  }, [geomorphs, props.mapKey]);

  React.useEffect(() => {
    if (!state.threeReady || !state.mapHash) {
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
    state.mapHash,
    state.layoutsHash,
    // geomorphs, // HMR reload on focus hack
  ]);

  return (
    <TestWorldContext.Provider value={state}>
      <TestWorldCanvas disabled={props.disabled} stats>
        {geomorphs && <TestWorldScene disabled={props.disabled} />}
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
 * @property {string} mapKey
 * @property {number} layoutsHash For HMR
 * @property {number} mapHash For HMR
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {number} reqAnimId
 * @property {Timer} timer
 *
 * @property {import('./TestWorldCanvas').State} view
 * @property {import('./TestWorldScene').State} scene
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmData
 * Only populated for geomorphs seen in some map.
 * @property {Geomorph.LayoutInstance[]} gms Aligned to `map.gms`.
 * @property {TiledCacheResult & { query: NavMeshQuery }} nav
 * @property {Crowd} crowd
 * @property {import('@recast-navigation/core').CrowdAgent[]} agents
 * @property {{ navMesh: NavMeshHelper; crowd: CrowdHelper; navPath: NavPathHelper }} help
 *
 * @property {() => void} addHelpers
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureGmData
 * @property {(e: MessageEvent<WW.NavMeshResponse>) => Promise<void>} handleMessageFromWorker
 * @property {(exportedNavMesh: Uint8Array) => void} loadTiledMesh
 * @property {() => void} setupDemoCrowd
 * @property {() => void} update
 * @property {() => void} updateCrowd
 * @property {(dst: import('three').Vector3Like) => void} walkTo
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
