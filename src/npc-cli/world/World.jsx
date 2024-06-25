import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd } from "@recast-navigation/core";

import { GEOMORPHS_JSON_FILENAME, assetsEndpoint, imgExt } from "src/const";
import { Vect } from "../geom";
import { gmFloorExtraScale, sguToWorldScale } from "../service/const";
import { assertNonNull, info, debug, isDevelopment, keys, warn } from "../service/generic";
import { getAssetQueryParam, invertCanvas, tmpCanvasCtxts } from "../service/dom";
import { removeCached, setCached } from "../service/query-client";
import { geomorphService } from "../service/geomorph";
import { decompToXZGeometry, imageLoader, textureLoader, tmpBufferGeom1 } from "../service/three";
import { disposeCrowd, getTileCacheMeshProcess } from "../service/recast-detour";
import { npcService } from "../service/npc";
import { WorldContext } from "./world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useHandleEvents from "./use-handle-events";
import WorldCanvas from "./WorldCanvas";
import Floor from "./Floor";
import Ceiling from "./Ceiling";
import Obstacles from "./Obstacles";
import WallsAndDoors from "./WallsAndDoors";
import Npcs from "./Npcs";
import Debug from "./Debug";
import ContextMenu from "./ContextMenu";

/**
 * @param {Props} props
 */
export default function World(props) {
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

    derived: { doorCount: 0, obstaclesCount: 0, wallCount: 0 },
    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gmClass: /** @type {*} */ ({}), // 🚧 move into Floor, Ceiling?
    gms: [],
    hmr: { hash: '', gmHash: '' },
    obsTex: /** @type {*} */ (null),
    decorTex: /** @type {*} */ (null),

    nav: /** @type {*} */ (null),
    crowd: /** @type {*} */ (null),

    ui: /** @type {*} */ (null), // WorldCanvas
    floor: /** @type {*} */ (null), // Floor
    ceil: /** @type {*} */ (null), // Ceiling
    obs: /** @type {*} */ (null), // Obstacles
    vert: /** @type {State['vert']} */ ({
      onTick() {},
      toggleDoor(_instanceId) {},
    }), // WallsAndDoors
    npc: /** @type {*} */ (null), // Npcs
    menu: /** @type {*} */ (null), // ContextMenu
    debug: /** @type {*} */ (null), // Debug
    lib: {
      filter,
      firstValueFrom,
      isVectJson: Vect.isVectJson,
      vectFrom: Vect.from,
      ...npcService,
    },

    ensureGmClass(gmKey) {// 🚧 rethink e.g. ≥ 4 gmKeys per tex
      const layout = state.geomorphs.layout[gmKey];
      let gmClass = state.gmClass[gmKey];
      if (!gmClass) {
        const floorEl = document.createElement("canvas");
        const ceilEl = document.createElement("canvas");
        // Scale up canvas for higher resolution
        ceilEl.width = floorEl.width = (layout.pngRect.width / sguToWorldScale) * gmFloorExtraScale;
        ceilEl.height = floorEl.height = (layout.pngRect.height / sguToWorldScale) * gmFloorExtraScale;
        gmClass = state.gmClass[gmKey] = {
          ceil: [assertNonNull(ceilEl.getContext("2d")), new THREE.CanvasTexture(ceilEl), ceilEl],
          floor: [assertNonNull(floorEl.getContext("2d")), new THREE.CanvasTexture(floorEl), floorEl],
        };
        // align with XZ quad uv-map
        gmClass.floor[1].flipY = false;
        gmClass.ceil[1].flipY = false;
      }
      return gmClass;
    },
    async handleMessageFromWorker(e) {
      const msg = e.data;
      info("main thread received message", msg);
      if (msg.type === "nav-mesh-response") {
        await initRecastNav();
        state.loadTiledMesh(msg.exportedNavMesh);
        update(); // <Npcs>
      }
    },
    isReady() {
      return state.geomorphs !== null && state.crowd !== null;
    },
    loadTiledMesh(exportedNavMesh) {
      state.nav = /** @type {NPC.TiledCacheResult} */ (
        importNavMesh(exportedNavMesh, getTileCacheMeshProcess())
      );
      state.crowd && disposeCrowd(state.crowd);
      state.crowd = new Crowd(state.nav.navMesh, {
        maxAgents: 10,
        maxAgentRadius: npcService.defaults.radius,
      });
      // state.crowd.timeFactor

      state.npc?.restore();
    },
    onTick() {
      state.reqAnimId = requestAnimationFrame(state.onTick);
      state.timer.update();
      const deltaMs = state.timer.getDelta();
      // state.crowd.update(1 / 60, deltaMs);
      state.crowd.update(deltaMs);
      state.npc.onTick(deltaMs);
      state.vert.onTick();
      // info(state.r3f.gl.info.render);
    },
    update,
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

        map.gms.forEach(({ gmKey }) => state.ensureGmClass(gmKey));

        state.gms = map.gms.map(({ gmKey, transform }, gmId) => 
          geomorphService.computeLayoutInstance(state.geomorphs.layout[gmKey], gmId, transform)
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

      /** @type {const} */ ([
        { src: `${assetsEndpoint}/2d/obstacles.${imgExt}${getAssetQueryParam()}`, texKey: 'obsTex', invert: true, },
        { src: `${assetsEndpoint}/2d/decor.${imgExt}${getAssetQueryParam()}`, texKey: 'decorTex', invert: false },
      ]).forEach(({ src, texKey, invert }) => {
        imageLoader.loadAsync(src).then((img) => {
          const canvas = document.createElement('canvas');
          [canvas.width, canvas.height] = [img.width, img.height];
          /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).drawImage(img, 0, 0);
          invert && invertCanvas(canvas, tmpCanvasCtxts[0], tmpCanvasCtxts[1]);
          const tex = new THREE.CanvasTexture(canvas);
          tex.flipY = false; // align with XZ/XY quad uv-map
          state[texKey] = tex;
          update();
        });
      })

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

  React.useEffect(() => {// (re)start worker on(change) geomorphs.json (not HMR)
    const hmr = state.crowd && state.geomorphs?.hash === state.hmr.gmHash;
    state.hmr.gmHash = state.geomorphs?.hash ?? '';
    if (state.threeReady && state.hash && !hmr) {
      state.worker = new Worker(new URL("./recast.worker", import.meta.url), { type: "module" });
      state.worker.addEventListener("message", state.handleMessageFromWorker);
      return () => void state.worker.terminate();
    }
  }, [state.threeReady, state.geomorphs?.hash]);

  React.useEffect(() => {// request nav-mesh onchange geomorphs.json or mapKey (not HMR)
    const hmr = state.crowd && state.hash === state.hmr.hash;
    state.hmr.hash = state.hash;
    if (state.threeReady && state.hash && !hmr) {
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
    <WorldContext.Provider value={state}>
      <WorldCanvas disabled={props.disabled} stats>
        {state.geomorphs && (
          <group>
            <group>
              <Floor />
              <Ceiling />
              <Obstacles />
              <WallsAndDoors />
            </group>
            {state.crowd && <>
              <Npcs/>
              <Debug
                // showNavMesh
                // showOrigNavPoly
              />
            </>}
          </group>
        )}
      </WorldCanvas>
      <ContextMenu />
    </WorldContext.Provider>
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
 * @property {{ hash: string; gmHash: string; }} hmr
 * Change-tracking for Hot Module Reloading (HMR) only
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {number} reqAnimId
 * @property {import("@react-three/fiber").RootState} r3f
 * @property {Timer} timer
 * @property {WW.WorkerGeneric<WW.MessageToWorker, WW.MessageFromWorker>} worker
 *
 * @property {import('./WorldCanvas').State} ui
 * @property {import('./Floor').State} floor
 * @property {import('./Ceiling').State} ceil
 * @property {import('./Obstacles').State} obs
 * Flat static objects: floor, ceiling, and obstacles
 * @property {import('./WallsAndDoors').State} vert
 * Vertical objects: doors (dynamic) and walls (static)
 * @property {import('./Npcs').State} npc
 * Npcs (dynamic)
 * @property {import('./ContextMenu').State} menu
 * @property {import('./Debug').State} debug
 * @property {StateUtil & import("../service/npc").NpcService} lib
 *
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmClass
 * @property {THREE.CanvasTexture} obsTex CanvasTexture for pixel lookup
 * @property {THREE.CanvasTexture} decorTex CanvasTexture for pixel lookup
 * @property {Geomorph.LayoutInstance[]} gms
 * Aligned to `map.gms`.
 * Only populated for geomorph keys seen in some map.
 * @property {NPC.TiledCacheResult} nav
 * @property {Crowd} crowd
 *
 * @property {(gmKey: Geomorph.GeomorphKey) => GmData} ensureGmClass
 * @property {(e: MessageEvent<WW.NavMeshResponse>) => Promise<void>} handleMessageFromWorker
 * @property {() => boolean} isReady
 * @property {(exportedNavMesh: Uint8Array) => void} loadTiledMesh
 * @property {() => void} update
 * @property {() => void} onTick
 */

/**
 * @typedef GmData
 * @property {CanvasTexDef} ceil
 * @property {Pretty<CanvasTexDef>} floor
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
