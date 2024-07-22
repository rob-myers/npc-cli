import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd } from "@recast-navigation/core";

import { Vect } from "../geom";
import { GmGraphClass } from "../graph/gm-graph";
import { GmRoomGraphClass } from "../graph/gm-room-graph";
import { gmFloorExtraScale, worldToSguScale } from "../service/const";
import { info, debug, isDevelopment, keys, warn, removeFirst, toPrecision, pause } from "../service/generic";
import { invertCanvas, tmpCanvasCtxts } from "../service/dom";
import { removeCached, setCached } from "../service/query-client";
import { fetchGeomorphsJson, getDecorSheetUrl, getObstaclesSheetUrl, WORLD_QUERY_FIRST_KEY } from "../service/fetch-assets";
import { geomorphService } from "../service/geomorph";
import createGmsData from "../service/create-gms-data";
import { createCanvasTexMeta, imageLoader } from "../service/three";
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
import WorldWorkers from "./WorldWorker";

/**
 * @param {Props} props
 */
export default function World(props) {
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    key: props.worldKey,
    disabled: !!props.disabled,
    hash: /** @type {*} */ (''),
    decorHash: /** @type {*} */ (''),
    mapKey: props.mapKey,
    r3f: /** @type {*} */ (null),
    readyResolvers: [],
    reqAnimId: 0,
    threeReady: false,
    timer: new Timer(),

    nav: /** @type {*} */ ({}),
    physics: { worker: /** @type {*} */ (null), keyToNum: {}, numToKey: {} },

    gmsData: /** @type {*} */ (null),
    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gms: [],
    gmGraph: new GmGraphClass([]),
    gmRoomGraph: new GmRoomGraphClass(),
    hmr: { createGmsData },
    obsTex: createCanvasTexMeta(0, 0, { willReadFrequently: true }),
    decorTex: createCanvasTexMeta(0, 0, { willReadFrequently: true }),

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

    async awaitReady() {
      if (!state.isReady()) {
        return new Promise(resolve => state.readyResolvers.push(resolve));
      }
    },
    async handleNavWorkerMessage(e) {
      const msg = e.data;
      info("main thread received from nav worker", msg);
      if (msg.type === "nav-mesh-response") {
        await initRecastNav();
        state.loadTiledMesh(msg.exportedNavMesh);
        update(); // w.npc
        // state.setReady();
      }
    },
    async handlePhysicsWorkerMessage(e) {
      const msg = e.data;
      info("main thread received from physics worker", msg);
    },
    isReady() {
      return state.crowd !== null && state.decor?.queryStatus === 'success';
    },
    loadTiledMesh(exportedNavMesh) {
      const tiledCacheResult = /** @type {NPC.TiledCacheResult} */ (
        importNavMesh(exportedNavMesh, getTileCacheMeshProcess())
      );
      if (state.crowd) {
        disposeCrowd(state.crowd, state.nav.navMesh);
      }
      Object.assign(state.nav, tiledCacheResult);
      state.crowd = new Crowd(state.nav.navMesh, {
        maxAgents: 10,
        maxAgentRadius: npcService.defaults.radius,
      });
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
    setReady() {
      while (state.readyResolvers.length > 0) {
        /** @type {() => void} */ (state.readyResolvers.pop())();
      }
    },
    update(mutator) {
      mutator?.(state);
      update();
    },
  }));

  state.disabled = !!props.disabled;

  useHandleEvents(state);

  useQuery({
    queryKey: [WORLD_QUERY_FIRST_KEY, props.worldKey, props.mapKey],
    queryFn: async () => {
      // console.log('🔔 query debug', [WORLD_QUERY_FIRST_KEY, props.worldKey, props.mapKey])
      const prevGeomorphs = state.geomorphs;
      const geomorphsJson = await fetchGeomorphsJson();

      /**
       * Used to apply changes synchronously.
       * These values can be overridden below.
       * @type {Pick<State, 'geomorphs' | 'mapKey' | 'gms' | 'gmsData' | 'gmGraph' | 'gmRoomGraph'>}
       */
      const next = {
        geomorphs: prevGeomorphs,
        mapKey: props.mapKey,
        gms: state.gms,
        gmsData: state.gmsData,
        gmGraph: state.gmGraph,
        gmRoomGraph: state.gmRoomGraph,
      };

      const dataChanged = !prevGeomorphs || state.geomorphs.hash !== geomorphsJson.hash;
      const mapChanged = dataChanged || state.mapKey !== props.mapKey;

      if (dataChanged) {
        next.geomorphs = geomorphService.deserializeGeomorphs(geomorphsJson);
      }

      if (mapChanged) {
        next.mapKey = props.mapKey;
        const mapDef = next.geomorphs.map[state.mapKey];

        // on change map may see new gmKeys
        mapDef.gms.filter(x => !state.floor.tex[x.gmKey]).forEach(({ gmKey }) => {
          const { pngRect } = next.geomorphs.layout[gmKey];
          for (const lookup of [state.floor.tex, state.ceil.tex]) {
            lookup[gmKey] = createCanvasTexMeta(
              pngRect.width * worldToSguScale * gmFloorExtraScale,
              pngRect.height * worldToSguScale * gmFloorExtraScale,
              { willReadFrequently: true },
            );
          }
        });

        next.gms = mapDef.gms.map(({ gmKey, transform }, gmId) => 
          geomorphService.computeLayoutInstance(next.geomorphs.layout[gmKey], gmId, transform)
        );
      }
      
      // detect if the function `createGmsData` has changed
      const createGmsData = await import('../service/create-gms-data').then(x => x.default);
      const gmsDataChanged = state.hmr.createGmsData !== createGmsData;
      state.hmr.createGmsData = createGmsData;

      if (mapChanged || gmsDataChanged) {

        next.gmsData = createGmsData(
          // reuse gmData lookup, unless:
          // (a) geomorphs.json changed, or (b) create-gms-data changed
          { prevGmData: dataChanged || gmsDataChanged ? undefined : state.gmsData },
        );

        // ensure gmData per layout in map
        for (const gmKey of new Set(next.gms.map(({ key }) => key))) {
          if (next.gmsData[gmKey].unseen) {
            await pause(); // breathing space
            await next.gmsData.computeGmData(next.geomorphs.layout[gmKey]);
          }
        };
        
        next.gmsData.computeRoot(next.gms);
        
        await pause();
        next.gmGraph = GmGraphClass.fromGms(next.gms, { permitErrors: true });
        next.gmGraph.w = state;
        
        await pause();
        next.gmRoomGraph = GmRoomGraphClass.fromGmGraph(next.gmGraph, next.gmsData);
      }

      if (dataChanged || gmsDataChanged) {
        state.gmsData?.dispose();
      }
      // apply changes synchronously
      Object.assign(state, next);
      state.hash = `${state.mapKey} ${state.geomorphs.hash}`;
      state.decorHash = `${state.mapKey} ${state.geomorphs.layoutsHash} ${state.geomorphs.mapsHash}`;

      debug({
        prevGeomorphs: !!prevGeomorphs,
        dataChanged,
        mapChanged,
        gmsDataChanged,
        hash: state.hash,
      });      

      if (dataChanged) {
        for (const { src, tm, invert } of [
          { src: getObstaclesSheetUrl(), tm: state.obsTex, invert: true, },
          { src: getDecorSheetUrl(), tm: state.decorTex, invert: false },
        ]) {
          const img = await imageLoader.loadAsync(src);
          if (tm.canvas.width !== img.width || tm.canvas.height !== img.height) {// update texTuple
            [tm.canvas.width, tm.canvas.height] = [img.width, img.height];
            tm.tex.dispose();
            tm.tex = new THREE.CanvasTexture(tm.canvas);
            tm.tex.flipY = false; // align with XZ/XY quad uv-map
            tm.ct = /** @type {CanvasRenderingContext2D} */ (tm.canvas.getContext('2d', { willReadFrequently: true }));
          }
          tm.ct.drawImage(img, 0, 0);
          invert && invertCanvas(tm.canvas, tmpCanvasCtxts[0], tmpCanvasCtxts[1]);
          update();
        }
      } else {
        update();
      }

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
              <Obstacles />
              <Ceiling />
            </group>
            {state.crowd && <>
              <Decor />
              <Npcs />
              <Debug
                // showNavMesh
                // showOrigNavPoly
              />
            </>}
          </group>
        )}
      </WorldCanvas>
      <ContextMenu />
      <WorldWorkers />
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
 * @property {string} key This is `props.worldKey` and never changes
 * @property {boolean} disabled
 * @property {string} mapKey
 * @property {`${string} ${string}`} hash
 * `${mapKey} ${geomorphs.hash}` 
 * @property {`${string} ${number} ${number}`} decorHash
 * `${mapKey} ${geomorphs.layoutsHash} ${geomorphs.mapsHash}` 
 * @property {Geomorph.GmsData} gmsData
 * Data determined by `w.gms` or a `Geomorph.GeomorphKey`.
 * - A geomorph key is "non-empty" iff `gmsData[gmKey].wallPolyCount` non-zero.
 * @property {{ createGmsData: typeof createGmsData }} hmr
 * Change-tracking for Hot Module Reloading (HMR) only
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {(() => void)[]} readyResolvers
 * @property {number} reqAnimId
 * @property {import("@react-three/fiber").RootState} r3f
 * @property {Timer} timer
 *
 * @property {NavMeta} nav
 * @property {PhysicsMeta} physics
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
 * @property {import("../service/three").CanvasTexMeta} obsTex
 * @property {import("../service/three").CanvasTexMeta} decorTex
 * @property {Geomorph.LayoutInstance[]} gms
 * Aligned to `map.gms`.
 * Only populated for geomorph keys seen in some map.
 * @property {GmGraphClass} gmGraph
 * @property {GmRoomGraphClass} gmRoomGraph
 * @property {Crowd} crowd
 *
 * @property {() => Promise<void>} awaitReady
 * @property {(e: MessageEvent<WW.MsgFromNavWorker>) => Promise<void>} handleNavWorkerMessage
 * @property {(e: MessageEvent<WW.MsgFromPhysicsWorker>) => Promise<void>} handlePhysicsWorkerMessage
 * @property {() => boolean} isReady
 * @property {(exportedNavMesh: Uint8Array) => void} loadTiledMesh
 * @property {() => void} onTick
 * @property {() => void} setReady
 * @property {(mutator?: (w: State) => void) => void} update
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

/**
 * @typedef {NPC.TiledCacheResult & {
 *    worker: WW.WorkerGeneric<WW.MsgToNavWorker, WW.MsgFromNavWorker>
 * }} NavMeta
 */
/**
 * @typedef PhysicsMeta
 * @property {WW.WorkerGeneric<WW.MsgToPhysicsWorker, WW.MsgFromPhysicsWorker>} worker
 * @property {{ [bodyKey: string]: number }} keyToNum
 * @property {{ [bodyUid: number]: string }} numToKey
 */
