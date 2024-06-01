import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd } from "@recast-navigation/core";

import { GEOMORPHS_JSON_FILENAME, assetsEndpoint, imgExt } from "src/const";
import { Vect } from "../geom";
import { agentRadius, demoNpcsMeta, worldScale } from "../service/const";
import { assertNonNull, info, debug, isDevelopment, keys, warn } from "../service/generic";
import { getAssetQueryParam } from "../service/dom";
import { removeCached, setCached } from "../service/query-client";
import { geomorphService } from "../service/geomorph";
import { decompToXZGeometry, textureLoader, tmpBufferGeom1, tmpVectThree1 } from "../service/three";
import { disposeCrowd, getTileCacheMeshProcess } from "../service/recast-detour";
import { npcService } from "../service/npc";
import { TestWorldContext } from "./test-world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useTestHandleEvents from "./use-test-handle-events";
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
    hash: '',
    mapKey: props.mapKey,
    threeReady: false,
    r3f: /** @type {*} */ (null),
    reqAnimId: 0,
    timer: new Timer(),
    worker: /** @type {*} */ (null),

    derived: /** @type {*} */ ({}),
    events: new Subject(),
    floorImg: /** @type {*} */ ({}),
    geomorphs: /** @type {*} */ (null),
    gmClass: /** @type {*} */ ({}),
    gms: [],
    obsTex: new THREE.Texture(),

    nav: /** @type {*} */ (null),
    crowd: /** @type {*} */ (null),

    ui: /** @type {*} */ (null), // TestWorldCanvas
    flat: /** @type {*} */ (null), // TestSurfaces
    vert: /** @type {*} */ (null), // TestWallsAndDoors
    npc: /** @type {*} */ (null), // TestNpcs
    menu: /** @type {*} */ (null), // TestContextMenu
    debug: /** @type {*} */ (null), // TestDebug
    lib: {
      filter,
      firstValueFrom,
      isVectJson: Vect.isVectJson,
      vectFrom: Vect.from,
      ...npcService,
    },

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
    isReady() {
      return state.geomorphs !== null && state.crowd !== null;
    },
    loadTiledMesh(exportedNavMesh) {
      state.nav = /** @type {NPC.TiledCacheResult} */ (importNavMesh(exportedNavMesh, getTileCacheMeshProcess()));

      /** @type {NPC.BasicAgentLookup} */
      const agentsMeta = state.crowd ? disposeCrowd(state.crowd) : demoNpcsMeta;

      state.crowd = new Crowd({
        maxAgents: 10,
        maxAgentRadius: agentRadius,
        navMesh: state.nav.navMesh,
      });
      state.crowd.timeStep = 1 / 60;
      // state.crowd.timeFactor

      state.setupCrowdAgents(agentsMeta);
    },
    onTick() {
      state.reqAnimId = requestAnimationFrame(state.onTick);
      state.timer.update();
      const deltaMs = state.timer.getDelta();
      state.crowd.update(deltaMs);
      state.npc.onTick();
      state.vert.onTick();
      // info(state.r3f.gl.info.render);
    },
    setupCrowdAgents(agentsMeta) {
      Object.values(agentsMeta).forEach(({ agentKey, position, target, userData }) => {
        const npcKey = userData.npcKey;
        if (typeof npcKey === 'string' && state.npc?.npc[npcKey]) {
          // 🚧 npc.attachAgent via agent.userData.npcKey
          const npc = state.npc.npc[npcKey];
          npc.removeAgent();
          npc.attachAgent();
        } else {
          warn(`agent "${agentKey}" has no npcKey (${JSON.stringify(userData)})`)
          const agent = state.crowd.addAgent(position, {
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
          target && agent.goto(target);
        }
      });
    },
    update,
    walkTo(dst) {
      // 🚧
      const agent = state.npc.toAgent[state.npc.selected];
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

  useTestHandleEvents(state);

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
        state.derived.doorCount = state.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
        state.derived.wallCount = state.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
        state.derived.obstaclesCount = state.gms.reduce((sum, { obstacles }) => sum + obstacles.length, 0);
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

      keys(state.gmClass).forEach((gmKey) => textureLoader.loadAsync(
        `${assetsEndpoint}/2d/${gmKey}.floor.${imgExt}${getAssetQueryParam()}`
      ).then((tex) => {
        state.floorImg[gmKey] = tex.source.data;
        state.flat && state.events.next({ key: 'draw-floor-ceil', gmKey });
      }));

      textureLoader.loadAsync(
        `${assetsEndpoint}/2d/obstacles.${imgExt}${getAssetQueryParam()}`,
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

  React.useEffect(() => {// expose world for terminal
    setCached([props.worldKey], state);
    return () => removeCached([props.worldKey]);
  }, []);

  React.useEffect(() => {// (re)start worker on(change) geomorphs.json
    if (state.threeReady && state.hash) {
      state.worker = new Worker(new URL("./test-recast.worker", import.meta.url), { type: "module" });
      state.worker.addEventListener("message", state.handleMessageFromWorker);
      return () => void state.worker.terminate();
    }
  }, [state.threeReady, state.geomorphs?.hash]);

  React.useEffect(() => {// request nav-mesh onchange geomorphs.json or mapKey
    if (state.threeReady && state.hash) {
      state.worker.postMessage({ type: "request-nav-mesh", mapKey: state.mapKey });
    }
  }, [state.threeReady, state.hash]);

  React.useEffect(() => {// enable/disable animation
    state.timer.reset();
    if (!state.disabled && !!state.npc) {
      state.onTick();
    }
    return () => cancelAnimationFrame(state.reqAnimId);
  }, [state.disabled, state.npc]);

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
 * @property {WW.WorkerGeneric<WW.MessageToWorker, WW.MessageFromWorker>} worker
 *
 * @property {import('./TestWorldCanvas').State} ui
 * @property {import('./TestSurfaces').State} flat
 * Flat static objects: floor, ceiling, and obstacles
 * @property {import('./TestWallsAndDoors').State} vert
 * Vertical objects: doors (dynamic) and walls (static)
 * @property {import('./TestNpcs').State} npc
 * Npcs (dynamic)
 * @property {import('./TestContextMenu').State} menu
 * @property {import('./TestDebug').State} debug
 * @property {StateUtil & import("../service/npc").NpcService} lib
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
 * @property {() => boolean} isReady
 * @property {(exportedNavMesh: Uint8Array) => void} loadTiledMesh
 * @property {(agentsMeta: NPC.BasicAgentLookup) => void} setupCrowdAgents
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

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof import('../geom').Vect['isVectJson']} isVectJson
 * @property {typeof import('../geom').Vect['from']} vectFrom
 * @property {typeof filter} filter
 * //@property {typeof first} first
 * @property {typeof firstValueFrom} firstValueFrom
 * //@property {typeof map} map
 * //@property {typeof merge} merge
 * //@property {typeof precision} precision
 * //@property {typeof removeFirst} removeFirst
 * //@property {typeof take} take
 */
