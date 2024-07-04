import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd } from "@recast-navigation/core";

import { GEOMORPHS_JSON_FILENAME, assetsEndpoint, imgExt } from "src/const";
import { Vect } from "../geom";
import { gmFloorExtraScale, wallHeight, worldToSguScale } from "../service/const";
import { info, debug, isDevelopment, keys, warn, removeFirst, toPrecision, mapValues } from "../service/generic";
import { getAssetQueryParam, invertCanvas, tmpCanvasCtxts } from "../service/dom";
import { removeCached, setCached } from "../service/query-client";
import { geom } from "../service/geom";
import { geomorphService } from "../service/geomorph";
import createGmsData from "../service/create-gms-data";
import { createCanvasTexDef, imageLoader } from "../service/three";
import { disposeCrowd, getTileCacheMeshProcess } from "../service/recast-detour";
import { npcService } from "../service/npc";
import { WorldContext } from "./world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useHandleEvents from "./use-handle-events";
import WorldCanvas from "./WorldCanvas";
import Floor from "./Floor";
import Ceiling from "./Ceiling";
import Decor from "./Decor";
import Obstacles from "./Obstacles";
import Walls from "./Walls";
import Doors from "./Doors";
import Npcs from "./Npcs";
import Debug from "./Debug";
import ContextMenu from "./ContextMenu";
import { GmGraphClass } from "../graph/gm-graph";

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

    gmsData: createGmsData(),
    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gms: [],
    gmGraph: new GmGraphClass([]),
    hmr: { hash: '', gmHash: '' },
    obsTex: /** @type {*} */ (null),
    decorTex: /** @type {*} */ (null),

    nav: /** @type {*} */ (null),
    crowd: /** @type {*} */ (null),

    ui: /** @type {*} */ (null), // WorldCanvas
    floor: /** @type {State['floor']} */ ({ tex: {} }),
    ceil: /** @type {State['ceil']} */ ({ tex: {} }),
    decor: /** @type {*} */ (null), // Decor
    obs: /** @type {*} */ (null), // Obstacles
    wall: /** @type {*} */ (null),
    door: /** @type {State['door']} */ ({
      onTick() {},
      toggleDoor(_instanceId) {},
    }),
    npc: /** @type {*} */ (null), // Npcs
    menu: /** @type {*} */ (null), // ContextMenu
    debug: /** @type {*} */ (null), // Debug
    lib: {
      filter,
      firstValueFrom,
      isVectJson: Vect.isVectJson,
      precision: toPrecision,
      removeFirst,
      vectFrom: Vect.from,
      ...npcService,
    },

    // 🚧 fix HMR on edit computeGmData or computeGmsData,
    // e.g. recompute state.gmsData and redraw
    computeGmData(gm) {// recomputed onchange geomorphs.json (dev only)
      const gmData = state.gmsData[gm.key];

      gmData.doorSegs = gm.doors.map(({ seg }) => seg);
      gmData.polyDecals = gm.unsorted.filter(x => x.meta.poly === true);
      gmData.wallSegs = gm.walls.flatMap((x) => x.lineSegs.map(seg => ({ seg, meta: x.meta })));
      gmData.wallPolyCount = gm.walls.length;
      gmData.wallPolySegCounts = gm.walls.map(({ outline, holes }) =>
        outline.length + holes.reduce((sum, hole) => sum + hole.length, 0)
      );
      const nonHullWallsTouchCeil = gm.walls.filter(x => !x.meta.hull &&
        (x.meta.h === undefined || (x.meta.y + x.meta.h === wallHeight)) // touches ceiling
      );
      // inset so stroke does not jut out
      gmData.nonHullCeilTops = nonHullWallsTouchCeil.flatMap(x => geom.createInset(x, 0.04));
      gmData.doorCeilTops = gm.doors.flatMap(x => geom.createInset(x.poly, 0.04));

      gmData.hitCtxt ??= /** @type {CanvasRenderingContext2D} */ (
        document.createElement('canvas').getContext('2d')
      );
      gmData.hitCtxt.canvas.width = gm.pngRect.width;
      gmData.hitCtxt.canvas.height = gm.pngRect.height;
      
      // 🚧 compute connector.roomIds first
      // gmData.roomGraph = RoomGraphClass.from(RoomGraphClass.json(gm.rooms, gm.doors, gm.windows));

      gmData.unseen = false;
    },
    computeGmsData() {// recomputed when `w.gms` changes e.g. map changes
      const gmsData = state.gmsData;

      gmsData.doorCount = state.gms.reduce((sum, { key }) => sum + gmsData[key].doorSegs.length, 0);
      gmsData.wallCount = state.gms.reduce((sum, { key }) => sum + gmsData[key].wallSegs.length, 0);
      gmsData.obstaclesCount = state.gms.reduce((sum, { obstacles }) => sum + obstacles.length, 0);

      gmsData.wallPolySegCounts = state.gms.map(({ key: gmKey }) =>
        state.gmsData[gmKey].wallPolySegCounts.reduce((sum, count) => sum + count, 0),
      );
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
      state.door.onTick();
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
        const mapDef = state.geomorphs.map[state.mapKey];

        // on change map may see new gmKeys
        mapDef.gms.filter(x => !state.floor.tex[x.gmKey]).forEach(({ gmKey }) => {
          const { pngRect } = state.geomorphs.layout[gmKey];
          /** @type {const} */ (['floor', 'ceil']).forEach(apiKey => {
            state[apiKey].tex[gmKey] = createCanvasTexDef(
              pngRect.width * worldToSguScale * gmFloorExtraScale,
              pngRect.height * worldToSguScale * gmFloorExtraScale,
            );
          });
        });

        state.gms = mapDef.gms.map(({ gmKey, transform }, gmId) => 
          geomorphService.computeLayoutInstance(state.geomorphs.layout[gmKey], gmId, transform)
        );

        // recompute gm-dependent data onchange geomorphs.json, or not seen yet
        state.gms.forEach(gm => (dataChanged || state.gmsData[gm.key].unseen) && state.computeGmData(gm));
        // always recompute gms-dependent data
        state.computeGmsData();

        // 🚧 needs fixing i.e. throws errors
        // state.gmGraph = GmGraphClass.fromGms(state.gms);
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
              <Walls />
              <Doors />
              <Decor />
              <Obstacles />
              <Ceiling />
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
 * @property {Geomorph.GmsData} gmsData
 * Data determined by `w.gms` or a `Geomorph.GeomorphKey`.
 * - A geomorph key is "non-empty" iff `gmsData[gmKey].wallPolyCount` non-zero.
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
 * @property {import('./Decor').State} decor
 * @property {import('./Obstacles').State} obs
 * @property {import('./Walls').State} wall
 * @property {import('./Doors').State} door
 * @property {import('./Npcs').State} npc
 * Npcs (dynamic)
 * @property {import('./ContextMenu').State} menu
 * @property {import('./Debug').State} debug
 * @property {StateUtil & import("../service/npc").NpcService} lib
 *
 * @property {THREE.CanvasTexture} obsTex CanvasTexture for pixel lookup
 * @property {THREE.CanvasTexture} decorTex CanvasTexture for pixel lookup
 * @property {Geomorph.LayoutInstance[]} gms
 * Aligned to `map.gms`.
 * Only populated for geomorph keys seen in some map.
 * @property {GmGraphClass} gmGraph
 * @property {NPC.TiledCacheResult} nav
 * @property {Crowd} crowd
 *
 * @property {(gm: Geomorph.LayoutInstance) => void} computeGmData
 * Data dependent on underlying `Geomorph.Layout`
 * @property {() => void} computeGmsData
 * Data dependent on `w.gms: Geomorph.LayoutInstance[]`
 * @property {(e: MessageEvent<WW.NavMeshResponse>) => Promise<void>} handleMessageFromWorker
 * @property {() => boolean} isReady
 * @property {(exportedNavMesh: Uint8Array) => void} loadTiledMesh
 * @property {() => void} update
 * @property {() => void} onTick
 */

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof filter} filter
 * @property {typeof firstValueFrom} firstValueFrom
 * @property {typeof import('../geom').Vect['isVectJson']} isVectJson
 * @property {typeof removeFirst} removeFirst
 * @property {typeof toPrecision} precision
 * @property {typeof import('../geom').Vect['from']} vectFrom
 * 
 * //@property {typeof first} first
 * //@property {typeof map} map
 * //@property {typeof merge} merge
 * //@property {typeof take} take
 */
