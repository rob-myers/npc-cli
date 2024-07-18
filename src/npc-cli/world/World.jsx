import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd } from "@recast-navigation/core";

import { GEOMORPHS_JSON_FILENAME, WORLD_QUERY_FIRST_KEY, assetsEndpoint, imgExt } from "src/const";
import { Vect } from "../geom";
import { GmGraphClass } from "../graph/gm-graph";
import { GmRoomGraphClass } from "../graph/gm-room-graph";
import { decorLabelHeightSgu, gmFloorExtraScale, worldToSguScale } from "../service/const";
import { info, debug, isDevelopment, keys, warn, removeFirst, toPrecision, pause, hashJson, removeDups } from "../service/generic";
import { getAssetQueryParam, invertCanvas, tmpCanvasCtxts } from "../service/dom";
import { removeCached, setCached } from "../service/query-client";
import { geomorphService } from "../service/geomorph";
import createGmsData from "../service/create-gms-data";
import { createCanvasTexDef, getQuadGeometryXZ, imageLoader } from "../service/three";
import packRectangles from "../service/rects-packer";
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
    worker: /** @type {*} */ (null),

    gmsData: /** @type {*} */ (null),
    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gms: [],
    gmGraph: new GmGraphClass([]),
    gmRoomGraph: new GmRoomGraphClass(),
    hmr: { hash: '', gmHash: '', createGmsData },
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
    labels: {
      hash: 0,
      quad: getQuadGeometryXZ(`${props.worldKey}-labels-xz`),
      sheet: {},
      tex: new THREE.CanvasTexture(document.createElement('canvas')),
    },

    async awaitReady() {
      if (!state.isReady()) {
        return new Promise(resolve => state.readyResolvers.push(resolve));
      }
    },
    ensureLabelSheet(labelDecors) {
      // Avoid needless recompute
      const labels = removeDups(Array.from(labelDecors.map(x => /** @type {string} */ (x.meta.label)))).sort();
      const hash = hashJson(labels);
      if (hash === state.labels.hash) {
        return;
      }
      state.labels.hash = hash;
      
      // Create sprite-sheet
      const canvas = /** @type {HTMLCanvasElement} */ (state.labels.tex.image);
      const ct = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      ct.font = `${decorLabelHeightSgu}px 'Courier new'`;
      /** @type {import("../service/rects-packer").PrePackedRect<{ label: string }>[]} */
      const rects = labels.map(label => ({
        width: ct.measureText(label).width,
        height: decorLabelHeightSgu,
        data: { label },
      }));
      const bin = packRectangles(rects, { logPrefix: 'w.ensureLabelSheet', packedPadding: 2 });
      state.labels.sheet = bin.rects.reduce((agg, r) => {
        agg[r.data.label] = { x: r.x, y: r.y, width: r.width, height: r.height };
        return agg;
      }, /** @type {LabelsMeta['sheet']} */ ({}));
      
      // Draw sprite-sheet
      if (canvas.width !== bin.width || canvas.height !== bin.height) {
        state.labels.tex.dispose();
        [canvas.width, canvas.height] = [bin.width, bin.height];
        state.labels.tex = new THREE.CanvasTexture(canvas);
        state.labels.tex.flipY = false;
      }
      ct.clearRect(0, 0, bin.width, bin.height);
      ct.strokeStyle = ct.fillStyle = 'white';
      ct.font = `${decorLabelHeightSgu}px 'Courier new'`;
      ct.textBaseline = 'top';
      bin.rects.forEach(rect => {
        ct.fillText(rect.data.label, rect.x, rect.y);
        ct.strokeText(rect.data.label, rect.x, rect.y);
      });
      state.labels.tex.needsUpdate = true;

      // Compute UVs
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      
      for (const d of labelDecors) {
        const { x, y, width, height } = state.labels.sheet[d.meta.label];
        uvOffsets.push(x / bin.width, y / bin.height);
        uvDimensions.push(width / bin.width, height / bin.height);
      }

      state.labels.quad.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.labels.quad.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
    },
    async handleMessageFromWorker(e) {
      const msg = e.data;
      info("main thread received message", msg);
      if (msg.type === "nav-mesh-response") {
        await initRecastNav();
        state.loadTiledMesh(msg.exportedNavMesh);
        update(); // w.npc
        // state.setReady();
      }
    },
    isReady() {
      return state.crowd !== null && state.decor?.queryStatus === 'success';
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

      const prevGeomorphs = state.geomorphs;
      const geomorphsJson = /** @type {Geomorph.GeomorphsJson} */ (
        await fetch(
          `${assetsEndpoint}/${GEOMORPHS_JSON_FILENAME}${getAssetQueryParam()}`
        ).then((x) => x.json())
      );

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
            lookup[gmKey] = createCanvasTexDef(
              pngRect.width * worldToSguScale * gmFloorExtraScale,
              pngRect.height * worldToSguScale * gmFloorExtraScale,
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
        /** @type {const} */ ([
          { src: `${assetsEndpoint}/2d/obstacles.${imgExt}${getAssetQueryParam()}`, texKey: 'obsTex', invert: true, },
          { src: `${assetsEndpoint}/2d/decor.${imgExt}${getAssetQueryParam()}`, texKey: 'decorTex', invert: false },
        ]).forEach(({ src, texKey, invert }) => imageLoader.loadAsync(src).then((img) => {
          const prevCanvas = /** @type {HTMLCanvasElement | undefined} */ (state[texKey]?.image);
          const canvas = prevCanvas ?? document.createElement('canvas');
          [canvas.width, canvas.height] = [img.width, img.height];
          /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).drawImage(img, 0, 0);
          invert && invertCanvas(canvas, tmpCanvasCtxts[0], tmpCanvasCtxts[1]);
          const tex = new THREE.CanvasTexture(canvas);
          tex.flipY = false; // align with XZ/XY quad uv-map
          state[texKey] = tex;
          update();
        }));
      } else {
        update(); // Needed?
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
 * @property {{ hash: string; gmHash: string; createGmsData: typeof createGmsData }} hmr
 * Change-tracking for Hot Module Reloading (HMR) only
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {LabelsMeta} labels
 * @property {boolean} threeReady
 * @property {(() => void)[]} readyResolvers
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
 * @property {THREE.CanvasTexture} obsTex
 * @property {THREE.CanvasTexture} decorTex
 * @property {Geomorph.LayoutInstance[]} gms
 * Aligned to `map.gms`.
 * Only populated for geomorph keys seen in some map.
 * @property {GmGraphClass} gmGraph
 * @property {GmRoomGraphClass} gmRoomGraph
 * @property {NPC.TiledCacheResult} nav
 * @property {Crowd} crowd
 *
 * @property {() => Promise<void>} awaitReady
 * @property {(labels: Geomorph.DecorPoint[]) => void} ensureLabelSheet
 * @property {(e: MessageEvent<WW.NavMeshResponse>) => Promise<void>} handleMessageFromWorker
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
 * @typedef LabelsMeta
 * @property {number} hash
 * @property {THREE.BufferGeometry} quad
 * @property {{ [label: string]: Geom.RectJson }} sheet
 * @property {THREE.CanvasTexture} tex
 */