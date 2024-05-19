import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd } from "@recast-navigation/core";

import { GEOMORPHS_JSON_FILENAME, assetsEndpoint, imgExt, imgExtFallback } from "src/const";
import { agentRadius, worldScale } from "../service/const";
import { assertNonNull, info, debug, isDevelopment, keys } from "../service/generic";
import { getAssetQueryParam } from "../service/dom";
import { removeCached, setCached } from "../service/query-client";
import { geomorphService } from "../service/geomorph";
import { decompToXZGeometry, texLoadAsyncFallback, tmpBufferGeom1, tmpVectThree1 } from "../service/three";
import { getTileCacheMeshProcess } from "../service/recast-detour";
import { TestWorldContext } from "./test-world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useHandleEvents from "./use-test-handle-events";
import TestWorldCanvas from "./TestWorldCanvas";
import TestSurfaces from "./TestSurfaces";
import TestWallsAndDoors from "./TestWallsAndDoors";
import TestNpcs from "./TestNpcs";
import TestDebug from "./TestDebug";
import TestContextMenu from "./TestContextMenu";

/**
 * @param {Props} props
 */
export default function TestWorld(props) {
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    disabled: !!props.disabled,
    mapKey: props.mapKey,
    hash: '',
    threeReady: false,
    reqAnimId: 0,
    timer: new Timer(),
    r3f: /** @type {*} */ (null),

    derived: /** @type {*} */ ({}),
    events: new Subject(),
    floorImg: /** @type {*} */ ({}),
    geomorphs: /** @type {*} */ (null),
    gmClass: /** @type {*} */ ({}),
    gms: [],
    obsTex: new THREE.Texture(),

    nav: /** @type {*} */ (null),
    crowd: /** @type {*} */ (null),

    view: /** @type {*} */ (null), // TestWorldCanvas
    surfaces: /** @type {*} */ (null), // TestSurfaces
    doors: /** @type {*} */ (null), // TestWallsAndDoors
    npcs: /** @type {*} */ (null), // TestNpcs
    menu: /** @type {*} */ (null), // TestContextMenu
    debug: /** @type {*} */ (null), // TestDebug

    ensureGmClass(gmKey) {
      const layout = state.geomorphs.layout[gmKey];
      let gmClass = state.gmClass[gmKey];
      if (!gmClass) {
        const floorEl = document.createElement("canvas");
        const ceilEl = document.createElement("canvas");
        // Standard non-edge geomorph approx. 1200 * 1200 (extends beyond edges)
        ceilEl.width = floorEl.width = layout.pngRect.width / worldScale;
        ceilEl.height = floorEl.height = layout.pngRect.height / worldScale;
        gmClass = state.gmClass[gmKey] = {
          ceil: [assertNonNull(ceilEl.getContext("2d")), new THREE.CanvasTexture(ceilEl), ceilEl],
          floor: [assertNonNull(floorEl.getContext("2d")), new THREE.CanvasTexture(floorEl), floorEl],
          layout,
          debugNavPoly: tmpBufferGeom1,
        };
      }
      gmClass.layout = layout;
      // Fix normals for recast/detour... maybe due to earcut ordering?
      gmClass.debugNavPoly = decompToXZGeometry(layout.navDecomp, { reverse: true });
      return gmClass;
    },
    async handleMessageFromWorker(e) {
      const msg = e.data;
      info("main thread received message", msg);
      if (msg.type === "nav-mesh-response") {
        await initRecastNav();
        state.loadTiledMesh(msg.exportedNavMesh);
        update(); // TestNpcs
      }
    },
    loadTiledMesh(exportedNavMesh) {
      state.nav = /** @type {NPC.TiledCacheResult} */ (importNavMesh(exportedNavMesh, getTileCacheMeshProcess()));

      // remember agent positions
      const positions = /** @type {THREE.Vector3Like[]} */ ([]);
      const targets = /** @type {(null | THREE.Vector3Like)[]} */ ([]);

      if (state.crowd) {// cleanup
        state.crowd.getAgents().forEach((agent) => {
          positions.push(agent.position());
          targets.push(agent.corners().length ? {
            x: agent.raw.get_targetPos(0),
            y: agent.raw.get_targetPos(1),
            z: agent.raw.get_targetPos(2),
          } : null);
          state.crowd.removeAgent(agent);
        });
        state.crowd.destroy();
      }

      state.crowd = new Crowd({
        maxAgents: 10,
        maxAgentRadius: agentRadius,
        navMesh: state.nav.navMesh,
      });
      state.crowd.timeStep = 1 / 60;
      // state.crowd.timeFactor

      state.setupCrowdAgents(positions.length
        ? positions
        : [
            { x: 1 * 1.5, y: 0, z: 5 * 1.5 },
            { x: 5 * 1.5, y: 0, z: 7 * 1.5 },
          ].map(x => state.crowd.navMeshQuery.getClosestPoint(x)),
        targets,
      );
    },
    onTick() {
      state.reqAnimId = requestAnimationFrame(state.onTick);
      state.timer.update();
      const deltaMs = state.timer.getDelta();
      state.crowd.update(deltaMs);
      state.npcs.onTick();
      state.doors.onTick();
      // info(state.r3f.gl.info.render);
    },
    setupCrowdAgents(positions, targets) {
      positions.map((p, i) => {
        const agent = state.crowd.addAgent(p, {
          radius: agentRadius,
          height: 1.5,
          maxAcceleration: 4,
          maxSpeed: 2,
          pathOptimizationRange: agentRadius * 20,
          // collisionQueryRange: 2.5,
          collisionQueryRange: 0.7,
          separationWeight: 1,
          queryFilterType: 0,
          // obstacleAvoidanceType
        });
        const target = targets[i];
        target && agent.goto(target);
      });
    },
    update,
    walkTo(dst) {
      const agent = state.npcs.toAgent[state.npcs.selected];
      const src = agent.position();
      const query = state.crowd.navMeshQuery;
      // Agent may follow different path
      const path = query.computePath(src, dst, {
        filter: state.crowd.getFilter(0),
      });

      if (path.length && tmpVectThree1.copy(dst).distanceTo(path[path.length - 1]) < 0.05) {
        state.debug.setNavPath(path);
        agent.goto(dst); // nearest point/polygon relative to crowd defaults
      }
    },
  }));

  state.disabled = !!props.disabled;

  useHandleEvents(state);

  useQuery({
    queryKey: [GEOMORPHS_JSON_FILENAME, props.worldKey, props.mapKey],
    queryFn: async () => {

      const prevGeomorphs = state.geomorphs;
      const geomorphsJson = /** @type {Geomorph.GeomorphsJson} */ (
        await fetch(
          `${assetsEndpoint}/${GEOMORPHS_JSON_FILENAME}${getAssetQueryParam()}`
        ).then((x) => x.json())
      );

      const dataChanged = !prevGeomorphs || state.geomorphs.hash !== geomorphsJson.hash;
      const mapChanged = dataChanged || state.mapKey !== props.mapKey;

      if (dataChanged) {
        state.geomorphs = geomorphService.deserializeGeomorphs(geomorphsJson);
      }

      if (mapChanged) {
        state.mapKey = props.mapKey;
        const map = state.geomorphs.map[state.mapKey];
        state.gms = map.gms.map(({ gmKey, transform }, gmId) =>
          geomorphService.computeLayoutInstance(state.ensureGmClass(gmKey).layout, gmId, transform)
        );
      }

      state.hash = `${state.mapKey} ${state.geomorphs.hash}`;

      debug({
        prevGeomorphs: !!prevGeomorphs,
        dataChanged,
        mapChanged,
        hash: state.hash,
      });

      if (!dataChanged) {
        return null;
      }

      state.derived.doorCount = state.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
      state.derived.wallCount = state.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
      state.derived.obstaclesCount = state.gms.reduce((sum, { obstacles }) => sum + obstacles.length, 0);

      keys(state.gmClass).forEach((gmKey) => {
        texLoadAsyncFallback(
          `${assetsEndpoint}/2d/${gmKey}.floor.${imgExt}${getAssetQueryParam()}`,
          `${assetsEndpoint}/2d/${gmKey}.floor.${imgExtFallback}`,
        ).then((tex) => {
          state.floorImg[gmKey] = tex.source.data;
          state.surfaces && state.events.next({ key: 'draw-floor-ceil', gmKey });
        })
      });

      texLoadAsyncFallback(
        `${assetsEndpoint}/2d/obstacles.${imgExt}${getAssetQueryParam()}`,
        `${assetsEndpoint}/2d/obstacles.${imgExtFallback}`,
      ).then((tex) => {
        state.obsTex = tex;
        update();
      });

      return null;
    },
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
    enabled: state.threeReady, // 🔔 fixes horrible reset issue on mobile
    gcTime: 0, // concurrent queries with different mapKey can break HMR
    // throwOnError: true, // breaks on restart dev env
  });

  React.useMemo(() => {// props.worldKey should never change
    setCached(['world', props.worldKey], state);
    return () => removeCached(['world', props.worldKey]);
  }, []);

  React.useEffect(() => {
    if (state.threeReady && state.hash) {
      // 🔔 saw strange behaviour when inlined `new URL`.
      /** @type {WW.WorkerGeneric<WW.MessageToWorker, WW.MessageFromWorker>}  */
      const worker = new Worker(new URL("./test-recast.worker", import.meta.url), { type: "module" });
      worker.addEventListener("message", state.handleMessageFromWorker);
      worker.postMessage({ type: "request-nav-mesh", mapKey: state.mapKey });
      return () => void worker.terminate();
    }
  }, [state.threeReady, state.hash]);

  React.useEffect(() => {
    state.timer.reset();
    if (!state.disabled && !!state.npcs) {
      state.onTick();
    }
    return () => cancelAnimationFrame(state.reqAnimId);
  }, [state.disabled, state.npcs]);

  return (
    <TestWorldContext.Provider value={state}>
      <TestWorldCanvas disabled={props.disabled} stats>
        {state.geomorphs && (
          <group>
            <TestSurfaces />
            {state.crowd && <>
              <TestNpcs/>
              <TestDebug
                // showNavMesh
                // showOrigNavPoly
              />
            </>}
            <TestWallsAndDoors />
          </group>
        )}
      </TestWorldCanvas>
      <TestContextMenu />
    </TestWorldContext.Provider>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {keyof import('static/assets/geomorphs.json')['map']} mapKey
 * @property {string} worldKey
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * @property {string} mapKey
 * @property {string} hash
 * @property {{ wallCount: number; doorCount: number; obstaclesCount: number; }} derived
 * Data derived from other sources
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {number} reqAnimId
 * @property {import("@react-three/fiber").RootState} r3f
 * @property {Timer} timer
 *
 * @property {import('./TestWorldCanvas').State} view
 * @property {import('./TestSurfaces').State} surfaces
 * @property {import('./TestWallsAndDoors').State} doors
 * @property {import('./TestNpcs').State} npcs
 * @property {import('./TestContextMenu').State} menu
 * @property {import('./TestDebug').State} debug
 *
 * @property {Record<Geomorph.GeomorphKey, HTMLImageElement>} floorImg
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmClass
 * @property {THREE.Texture} obsTex
 * Only populated for geomorph keys seen in some map.
 * @property {Geomorph.LayoutInstance[]} gms Aligned to `map.gms`.
 * @property {NPC.TiledCacheResult} nav
 * @property {Crowd} crowd
 *
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureGmClass
 * @property {(e: MessageEvent<WW.NavMeshResponse>) => Promise<void>} handleMessageFromWorker
 * @property {(exportedNavMesh: Uint8Array) => void} loadTiledMesh
 * @property {(agentPositions: THREE.Vector3Like[], agentTargets: (THREE.Vector3Like | null)[]) => void} setupCrowdAgents
 * @property {() => void} update
 * @property {() => void} onTick
 * @property {(dst: import('three').Vector3Like) => void} walkTo
 */

/**
 * @typedef GmData
 * @property {CanvasTexDef} ceil
 * @property {Pretty<CanvasTexDef>} floor
 * @property {Geomorph.Layout} layout
 * @property {THREE.BufferGeometry} debugNavPoly
 */

/**
 * @typedef {Pretty<[
 *  CanvasRenderingContext2D,
 *  THREE.CanvasTexture,
 *  HTMLCanvasElement,
 * ]>} CanvasTexDef
 */
