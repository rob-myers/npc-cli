import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";
import { Timer } from "three-stdlib";
import { importNavMesh, init as initRecastNav, Crowd, NavMeshQuery } from "@recast-navigation/core";

import { GEOMORPHS_JSON_FILENAME } from "src/scripts/const";
import { agentRadius, worldScale } from "../service/const";
import { assertNonNull, info, isDevelopment, range } from "../service/generic";
import { removeCached, setCached } from "../service/query-client";
import { geomorphService } from "../service/geomorph";
import { decompToXZGeometry, polysToXZGeometry, tmpBufferGeom1, tmpVectThree1, wireFrameMaterial } from "../service/three";
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
    mapKey: props.mapKey,
    mapsHash: 0,
    layoutsHash: 0,
    threeReady: false,
    reqAnimId: 0,
    timer: new Timer(),

    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gmClass: /** @type {*} */ ({}),
    gms: [],

    nav: /** @type {*} */ (null),
    crowd: /** @type {*} */ (null),

    view: /** @type {*} */ (null), // TestWorldCanvas
    doors: /** @type {*} */ (null), // TestWallsAndDoors
    npcs: /** @type {*} */ (null), // TestNpcs
    debug: /** @type {*} */ (null), // TestDebug

    ensureGmClass(gmKey) {
      const layout = state.geomorphs.layout[gmKey];
      let gmClass = state.gmClass[gmKey];
      if (!gmClass) {
        const canvas = document.createElement("canvas");
        // Standard non-edge geomorph ~ 1200 * 1200 (extends beyond edges)
        canvas.width = layout.pngRect.width / worldScale;
        canvas.height = layout.pngRect.height / worldScale;
        gmClass = state.gmClass[gmKey] = {
          canvas,
          ctxt: assertNonNull(canvas.getContext("2d")),
          layout,
          tex: new THREE.CanvasTexture(canvas),
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
    queryKey: [GEOMORPHS_JSON_FILENAME],
    queryFn: async () => {
      /** @type {Geomorph.GeomorphsJson} */
      const json = await fetch(`/assets/${GEOMORPHS_JSON_FILENAME}`).then((x) => x.json());
      return geomorphService.deserializeGeomorphs(json);
    },
    refetchOnWindowFocus: isDevelopment() ? "always" : undefined,
    // throwOnError: true, // breaks on restart dev env
  });

  React.useMemo(() => {
    if (geomorphs) {
      state.geomorphs = geomorphs;
      const map = geomorphs.map[props.mapKey];
      state.gms = map.gms.map(({ gmKey, transform }, gmId) =>
        geomorphService.computeLayoutInstance(state.ensureGmClass(gmKey).layout, gmId, transform)
      );
      state.mapsHash = geomorphs.mapsHash;
      state.layoutsHash = geomorphs.layoutsHash;
      state.mapKey = props.mapKey;

      setCached(['world', props.mapKey], state);
      return () => removeCached(['world', props.mapKey]);
    }
  }, [geomorphs, props.mapKey]);

  React.useEffect(() => {
    if (state.threeReady && state.mapsHash) {
      // 🔔 strange behaviour when inlined `new URL`.
      // 🔔 assume worker already listening for events
      /** @type {WW.WorkerGeneric<WW.MessageToWorker, WW.MessageFromWorker>}  */
      const worker = new Worker(new URL("./test-recast.worker", import.meta.url), { type: "module" });
      worker.addEventListener("message", state.handleMessageFromWorker);
      worker.postMessage({ type: "request-nav-mesh", mapKey: props.mapKey });
      return () => void worker.terminate();
    }
  }, [
    state.threeReady,
    state.mapsHash,
    state.layoutsHash,
  ]);

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
            {/* 🔔 saw onPointerUp instances not updating */}
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
 * @property {number} layoutsHash For HMR
 * @property {string} mapKey
 * @property {number} mapsHash For HMR
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {number} reqAnimId
 * @property {Timer} timer
 *
 * @property {import('./TestWorldCanvas').State} view
 * @property {import('./TestWallsAndDoors').State} doors
 * @property {import('./TestNpcs').State} npcs
 * @property {import('./TestDebug').State} debug
 *
 * @property {Record<Geomorph.GeomorphKey, GmData>} gmClass
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
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctxt
 * @property {Geomorph.Layout} layout
 * @property {THREE.BufferGeometry} debugNavPoly
 * @property {THREE.CanvasTexture} tex
 */
