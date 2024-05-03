import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd, NavMeshQuery } from "@recast-navigation/core";

import { GEOMORPHS_JSON_FILENAME, assetsEndpoint, imgExt, imgExtFallback } from "src/const";
import { agentRadius, worldScale } from "../service/const";
import { assertNonNull, info, debug, isDevelopment, keys, range } from "../service/generic";
import { removeCached, setCached } from "../service/query-client";
import { geomorphService } from "../service/geomorph";
import { decompToXZGeometry, polysToXZGeometry, texLoadAsyncFallback, tmpBufferGeom1, tmpVectThree1, wireFrameMaterial } from "../service/three";
import { getTileCacheMeshProcess } from "../service/recast-detour";
import { TestWorldContext } from "./test-world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useHandleEvents from "./use-test-handle-events";
import TestWorldCanvas from "./TestWorldCanvas";
import TestGeomorphs from "./TestGeomorphs";
import TestWallsAndDoors from "./TestWallsAndDoors";
import TestNpcs from "./TestNpcs";
import TestDebug from "./TestDebug";

/**
 * @param {Props} props
 */
export default function TestWorld(props) {
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    disabled: !!props.disabled,
    everDrewImages: false,
    mapKey: props.mapKey,
    hash: '',
    threeReady: false,
    reqAnimId: 0,
    timer: new Timer(),

    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gmClass: /** @type {*} */ ({}),
    gms: [],
    sheet: /** @type {*} */ (null),

    nav: /** @type {*} */ (null),
    crowd: /** @type {*} */ (null),

    view: /** @type {*} */ (null), // TestWorldCanvas
    surfaces: /** @type {*} */ (null), // TestGeomorphs
    doors: /** @type {*} */ (null), // TestWallsAndDoors
    npcs: /** @type {*} */ (null), // TestNpcs
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
    ensureSheetTex(overwrite = false) {
      if (!state.sheet) {
        const canvas = document.createElement("canvas");
        canvas.width = state.geomorphs.sheet.obstaclesWidth;
        canvas.height = state.geomorphs.sheet.obstaclesHeight;
        state.sheet = {
          obstacle: [assertNonNull(canvas.getContext("2d")), new THREE.CanvasTexture(canvas), canvas],
          // ...
        };
      } else if (overwrite) {
        const [, tex, canvas] = state.sheet.obstacle;
        canvas.width = state.geomorphs.sheet.obstaclesWidth;
        canvas.height = state.geomorphs.sheet.obstaclesHeight;
        state.sheet.obstacle[1] = new THREE.CanvasTexture(canvas);
        // tex.dispose();
      }
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
        state.debug.navPath.setPath(path);
        agent.goto(dst); // nearest point/polygon relative to crowd defaults
      }
    },
  }));

  state.disabled = !!props.disabled;

  useHandleEvents(state);

  const { data: geomorphs } = useQuery({
    queryKey: [GEOMORPHS_JSON_FILENAME, state.surfaces ? props.mapKey : false],
    queryFn: async () => {
      const prevGeomorphs = state.geomorphs;
      const geomorphsJson = /** @type {Geomorph.GeomorphsJson} */ (
        await fetch(`${assetsEndpoint}/${GEOMORPHS_JSON_FILENAME}`).then((x) => x.json())
      );

      const dataChanged = !prevGeomorphs || state.geomorphs.hash !== geomorphsJson.hash;
      const mapChanged = dataChanged || state.mapKey !== props.mapKey;
      const sheetDimChanged = !!prevGeomorphs && (
        prevGeomorphs.sheet.obstaclesWidth !== geomorphsJson.sheet.obstaclesWidth
        || prevGeomorphs.sheet.obstaclesHeight !== geomorphsJson.sheet.obstaclesHeight
      );
      const shouldDraw = !!state.surfaces && (!state.everDrewImages || dataChanged || sheetDimChanged);


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
        sheetDimChanged,
        shouldDraw,
        hash: state.hash,
      });

      if (sheetDimChanged) {
        // must re-create texture if sprite-sheet dimensions changed 
        state.ensureSheetTex(true);
      }

      if (!shouldDraw) {
        return state.geomorphs;
      }

      keys(state.gmClass).forEach((gmKey) =>
        texLoadAsyncFallback(
          `${assetsEndpoint}/2d/${gmKey}.floor.${imgExt}`,
          `${assetsEndpoint}/2d/${gmKey}.floor.${imgExtFallback}`,
        ).then((tex) => {
          state.surfaces.floorImg[gmKey] = tex.source.data;
          state.surfaces.drawFloorAndCeil(gmKey);
          update();
        })
      );

      texLoadAsyncFallback(
        `${assetsEndpoint}/2d/obstacles.${imgExt}?v=${Date.now()}`,
        `${assetsEndpoint}/2d/obstacles.${imgExtFallback}`,
      ).then((tex) => {
        state.surfaces.drawObstaclesSheet(tex.source.data);
        const [, obstacles] = state.sheet.obstacle;
        obstacles.needsUpdate = true;
        // 🚧 WIP HMR edit 2
        update();
      });

      state.everDrewImages = true;

      return state.geomorphs; // e.g. for ReactQueryDevtools
    },
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
    gcTime: 5000,
    // throwOnError: true, // breaks on restart dev env
  });

  React.useMemo(() => {
    setCached(['world', props.mapKey], state);
    return () => removeCached(['world', props.mapKey]);
  }, []);

  React.useEffect(() => {
    if (state.threeReady && state.hash) {
      // 🔔 strange behaviour when inlined `new URL`.
      // 🔔 assume worker already listening for events
      /** @type {WW.WorkerGeneric<WW.MessageToWorker, WW.MessageFromWorker>}  */
      const worker = new Worker(new URL("./test-recast.worker", import.meta.url), { type: "module" });
      worker.addEventListener("message", state.handleMessageFromWorker);
      worker.postMessage({ type: "request-nav-mesh", mapKey: props.mapKey });
      state.ensureSheetTex();
      return () => void worker.terminate();
    }
  }, [state.threeReady, state.hash]);

  React.useEffect(() => {
    state.timer.reset();
    if (!state.disabled && !!state.npcs) {
      state.onTick();
    }
    return () => cancelAnimationFrame(state.reqAnimId);
  }, [state.disabled, state.npcs, state.geomorphs]);

  return (
    <TestWorldContext.Provider value={state}>
      <TestWorldCanvas disabled={props.disabled} stats>
        {geomorphs && (
          <group>
            <TestGeomorphs />
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
 * @property {boolean} everDrewImages
 * @property {string} mapKey
 * @property {string} hash
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {number} reqAnimId
 * @property {Timer} timer
 *
 * @property {import('./TestWorldCanvas').State} view
 * @property {import('./TestGeomorphs').State} surfaces
 * @property {import('./TestWallsAndDoors').State} doors
 * @property {import('./TestNpcs').State} npcs
 * @property {import('./TestDebug').State} debug
 *
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmClass
 * @property {Record<'obstacle', CanvasTexDef>} sheet
 * Only populated for geomorph keys seen in some map.
 * @property {Geomorph.LayoutInstance[]} gms Aligned to `map.gms`.
 * @property {NPC.TiledCacheResult} nav
 * @property {Crowd} crowd
 *
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureGmClass
 * @property {(overwrite?: boolean) => void} ensureSheetTex
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