import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, Crowd } from "@recast-navigation/core";

import { Vect } from "../geom";
import { GmGraphClass } from "../graph/gm-graph";
import { GmRoomGraphClass } from "../graph/gm-room-graph";
import { gmFloorExtraScale, gmLabelHeightSgu, spriteSheetDecorExtraScale, worldToSguScale } from "../service/const";
import { debug, isDevelopment, keys, warn, removeFirst, toPrecision, pause, mapValues } from "../service/generic";
import { invertCanvas, tmpCanvasCtxts } from "../service/dom";
import { removeCached, setCached } from "../service/query-client";
import { fetchGeomorphsJson, getDecorSheetUrl, getObstaclesSheetUrl, WORLD_QUERY_FIRST_KEY } from "../service/fetch-assets";
import { geomorph } from "../service/geomorph";
import createGmsData from "../service/create-gms-data";
import { createCanvasTexMeta, imageLoader } from "../service/three";
import { disposeCrowd, getTileCacheMeshProcess } from "../service/recast-detour";
import { helper } from "../service/helper";
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
import WorldMenu from "./WorldMenu";
import WorldWorkers from "./WorldWorkers";

/**
 * @param {Props} props
 */
export default function World(props) {
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    key: props.worldKey,
    disabled: !!props.disabled,
    hash: /** @type {State['hash']} */ ({
      full: /** @type {*} */ (''),
    }),
    mapKey: props.mapKey,
    r3f: /** @type {*} */ (null),
    reqAnimId: 0,
    threeReady: false,
    timer: new Timer(),

    nav: /** @type {*} */ ({}),
    physics: { worker: /** @type {*} */ (null), bodyKeyToUid: {}, bodyUidToKey: {} },

    gmsData: /** @type {*} */ (null),
    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gms: [],
    gmGraph: new GmGraphClass([]),
    gmRoomGraph: new GmRoomGraphClass(),
    hmr: /** @type {*} */ ({}),
    // 🚧 avoid recreating texture on HMR
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
    }),
    npc: /** @type {*} */ (null), // Npcs
    menu: /** @type {*} */ (null), // ContextMenu
    debug: /** @type {*} */ (null), // Debug
    // 🚧 support hmr e.g. via state.hmr
    lib: {
      filter,
      firstValueFrom,
      isVectJson: Vect.isVectJson,
      precision: toPrecision,
      removeFirst,
      vectFrom: Vect.from,
      Subject,
      ...helper,
    },

    e: /** @type {*} */ (null), // useHandleEvents
    n: /** @type {*} */ {}, // w.npc.npc
    oneTimeTicks: [],

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
        maxAgentRadius: helper.defaults.radius,
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

      while (state.oneTimeTicks.shift()?.());
    },
    trackHmr(nextHmr) {
      const output = mapValues(state.hmr, (prev, key) => prev !== nextHmr[key])
      return state.hmr = nextHmr, output;
    },
    update(mutator) {
      mutator?.(state);
      update();
    },
  }));

  state.disabled = !!props.disabled;

  useHandleEvents(state);

  const query = useQuery({
    queryKey: [WORLD_QUERY_FIRST_KEY, props.worldKey, props.mapKey],
    queryFn: async () => {
      if (module.hot?.active === false) {
        return false; // Avoid query from disposed module
      }
      const prevGeomorphs = state.geomorphs;
      const geomorphsJson = await fetchGeomorphsJson();

      /**
       * Used to apply changes synchronously.
       * @type {Pick<State, 'geomorphs' | 'gms' | 'gmsData' | 'gmGraph' | 'gmRoomGraph' | 'hash' | 'mapKey'>}
       */
      const next = {
        // previous values (possibly overwritten below)
        geomorphs: prevGeomorphs,
        gms: state.gms,
        gmsData: state.gmsData,
        gmGraph: state.gmGraph,
        gmRoomGraph: state.gmRoomGraph,
        // next values
        hash: geomorph.computeHash(geomorphsJson, props.mapKey),
        mapKey: props.mapKey,
      };

      const dataChanged = !prevGeomorphs || state.hash.full !== next.hash.full;
      if (dataChanged) {
        next.geomorphs = geomorph.deserializeGeomorphs(geomorphsJson);
      }
      
      const mapChanged = dataChanged || state.mapKey !== props.mapKey;
      if (mapChanged) {
        next.mapKey = props.mapKey;
        const mapDef = next.geomorphs.map[next.mapKey];

        // onchange map may see new gmKeys
        for(const { gmKey } of mapDef.gms.filter(x => !state.floor.tex[x.gmKey])) {
          const { pngRect } = next.geomorphs.layout[gmKey];
          for (const lookup of [state.floor.tex, state.ceil.tex]) {
            lookup[gmKey] = createCanvasTexMeta(
              pngRect.width * worldToSguScale * gmFloorExtraScale,
              pngRect.height * worldToSguScale * gmFloorExtraScale,
              { willReadFrequently: true },
            );
          }
        }

        next.gms = mapDef.gms.map(({ gmKey, transform }, gmId) => 
          geomorph.computeLayoutInstance(next.geomorphs.layout[gmKey], gmId, transform)
        );
      }
      
      const { createGmsData: gmsDataChanged, GmGraphClass: gmGraphChanged } = state.trackHmr(
        { createGmsData, GmGraphClass },
      );

      if (mapChanged || gmsDataChanged) {
        next.gmsData = createGmsData(
          // reuse gmKey -> GmData lookup unless geomorphs.json or createGmsData changed
          { prevGmData: dataChanged || gmsDataChanged ? undefined : state.gmsData },
        );

        // ensure GmData per gmKey in map
        state.menu.measure('gmsData');
        for (const gmKey of new Set(next.gms.map(({ key }) => key))) {
          if (next.gmsData[gmKey].unseen) {
            await pause(); // breathing space
            await next.gmsData.computeGmData(next.geomorphs.layout[gmKey]);
          }
        };
        next.gmsData.computeRoot(next.gms);
        state.menu.measure('gmsData');
      }
      
      if (mapChanged || gmsDataChanged || gmGraphChanged) {
        await pause();
        state.menu.measure('gmGraph');
        next.gmGraph = GmGraphClass.fromGms(next.gms, { permitErrors: true });
        state.menu.measure('gmGraph');
        next.gmGraph.w = state;
        
        await pause();
        state.menu.measure('gmRoomGraph');
        next.gmRoomGraph = GmRoomGraphClass.fromGmGraph(next.gmGraph, next.gmsData);
        state.menu.measure('gmRoomGraph');
      }

      // apply changes synchronously
      if (state.gmGraph !== next.gmGraph) {
        state.gmGraph.dispose();
        state.gmRoomGraph.dispose();
      }
      if (dataChanged || gmsDataChanged) {
        // only when GmData lookup has been rebuilt
        state.gmsData?.dispose();
      }
      Object.assign(state, next);
      debug({
        prevGeomorphs: !!prevGeomorphs,
        dataChanged,
        mapChanged,
        gmsDataChanged,
        gmGraphChanged,
        hash: state.hash,
      });

      if (dataChanged) {// 🤔 separate hash.sheets from hash.full?
        for (const { src, tm, invert } of [
          { src: getObstaclesSheetUrl(), tm: state.obsTex, invert: true, },
          { src: getDecorSheetUrl(), tm: state.decorTex, invert: false },
        ]) {
          const img = await imageLoader.loadAsync(src);
          // 🔔 commenting below due to issue editing obstacle outlines
          // if (tm.canvas.width !== img.width || tm.canvas.height !== img.height) {// update texTuple
            [tm.canvas.width, tm.canvas.height] = [img.width, img.height];
            tm.tex.dispose();
            tm.tex = new THREE.CanvasTexture(tm.canvas);
            tm.tex.flipY = false; // align with XZ/XY quad uv-map
          // }
          tm.ct = /** @type {CanvasRenderingContext2D} */ (tm.canvas.getContext('2d', { willReadFrequently: true }));
          tm.ct.drawImage(img, 0, 0);
          invert && invertCanvas(tm.canvas, tmpCanvasCtxts[0], tmpCanvasCtxts[1]);
          // Sharper via getMaxAnisotropy()
          tm.tex.anisotropy = state.r3f.gl.capabilities.getMaxAnisotropy();
          tm.tex.needsUpdate = true;
          update();
        }
      } else {
        update();
      }

      return true;
    },
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
    enabled: state.threeReady, // 🔔 fixes horrible reset issue on mobile
    gcTime: 0, // concurrent queries with different mapKey can break HMR
    // throwOnError: true, // breaks on restart dev env
  });

  React.useEffect(() => {// provide world for tty + hmr query
    setCached([props.worldKey], state);
    query.data === false && query.refetch();
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
            <React.Suspense>
              {state.crowd && <>
                <Decor />
                <Npcs />
                <Debug
                  // showNavMesh
                  // showOrigNavPoly
                  showTestNpcs
                />
              </>}
            </React.Suspense>
          </group>
        )}
      </WorldCanvas>
      <WorldMenu setTabsEnabled={props.setTabsEnabled} />
      <WorldWorkers />
    </WorldContext.Provider>
  );
}

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps & {
 *   mapKey: keyof import('static/assets/geomorphs.json')['map'];
 *   worldKey: string;   
 * }} Props
 */

/**
 * @typedef State
 * @property {string} key This is `props.worldKey` and never changes
 * @property {boolean} disabled
 * @property {string} mapKey
 * @property {Geomorph.GeomorphsHash} hash
 * @property {Geomorph.GmsData} gmsData
 * Data determined by `w.gms` or a `Geomorph.GeomorphKey`.
 * - A geomorph key is "non-empty" iff `gmsData[gmKey].wallPolyCount` non-zero.
 * @property {{ createGmsData: typeof createGmsData; GmGraphClass: typeof GmGraphClass }} hmr
 * Change-tracking for Hot Module Reloading (HMR) only
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {number} reqAnimId
 * @property {import("@react-three/fiber").RootState} r3f
 * @property {Timer} timer
 *
 * @property {{ worker: WW.NavWorker } & NPC.TiledCacheResult} nav
 * @property {{ worker: WW.PhysicsWorker } & import("../service/rapier").PhysicsBijection} physics
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
 * @property {import('./WorldMenu').State} menu
 * @property {import('./Debug').State} debug
 * @property {StateUtil & import("../service/helper").Helper} lib
 *
 * @property {import("./use-handle-events").State} e
 * Events state i.e. useHandleEvents state
 * @property {import("./Npcs").State['npc']} n
 * Shortcut for `w.npc.npc`
 * @property {(() => void)[]} oneTimeTicks
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
 * @property {() => boolean} isReady
 * @property {(exportedNavMesh: Uint8Array) => void} loadTiledMesh
 * @property {() => void} onTick
 * @property {(next: State['hmr']) => Record<keyof State['hmr'], boolean>} trackHmr
 * Has function `createGmsData` changed?
 * @property {(mutator?: (w: State) => void) => void} update
 */

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof filter} filter
 * @property {typeof firstValueFrom} firstValueFrom
 * @property {typeof import('../geom').Vect['isVectJson']} isVectJson
 * @property {typeof removeFirst} removeFirst
 * @property {typeof Subject} Subject
 * @property {typeof toPrecision} precision
 * @property {typeof import('../geom').Vect['from']} vectFrom
 * 
 * //@property {typeof first} first
 * //@property {typeof map} map
 * //@property {typeof merge} merge
 * //@property {typeof take} take
 */

