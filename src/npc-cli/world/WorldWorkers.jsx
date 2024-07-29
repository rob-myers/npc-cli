import React from 'react';
import { init as initRecastNav } from "@recast-navigation/core";

import { info, isDevelopment } from '../service/generic';
import { WorldContext } from './world-context';
import useStateRef from '../hooks/use-state-ref';

/**
 * This component helps with HMR:
 * - avoid reloading the nav-mesh e.g. on edit World.jsx
 * - restart workers on edit handler (edit this file)
 * - restart workers on edit worker (via useless import)
 */
export default function WorldWorkers() {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    async handleNavWorkerMessage(e) {
      const msg = e.data;
      info("main thread received from nav worker", msg);
      if (msg.type === "nav-mesh-response") {
        await initRecastNav();
        w.loadTiledMesh(msg.exportedNavMesh);
        w.update(); // for w.npc
      }
    },
    async handlePhysicsWorkerMessage(e) {
      const msg = e.data;
      info("main thread received from physics worker", msg);
      if (msg.type === "npc-collisions") {
        msg.collisionEnd.forEach(({ npcKey, otherKey }) => {
          // 🚧 support otherKey not a GmDoorKey e.g. decor circle
          const gdKey = /** @type {Geomorph.GmDoorKey} */ (otherKey);
          w.events.next({ key: 'exited-sensor', npcKey, type: 'door', ...w.lib.getGmDoorId(gdKey) });
        });
        msg.collisionStart.forEach(({ npcKey, otherKey }) => {
          // 🚧 support otherKey not a GmDoorKey e.g. decor circle
          const gdKey = /** @type {Geomorph.GmDoorKey} */ (otherKey);
          w.events.next({ key: 'entered-sensor', npcKey, type: 'door', ...w.lib.getGmDoorId(gdKey) });
        });
      }
    },
  }));

  React.useEffect(() => {// (re)start worker on(change) geomorphs.json
    if (w.threeReady && w.hash) {
      w.nav.worker = new Worker(new URL("./nav.worker", import.meta.url), { type: "module" });
      w.nav.worker.addEventListener("message", state.handleNavWorkerMessage);
      
      w.physics.worker = new Worker(new URL("./physics.worker", import.meta.url), { type: "module" });
      w.physics.worker.addEventListener("message", state.handlePhysicsWorkerMessage);

      return () => {
        w.nav.worker.terminate();
        w.physics.worker.terminate();
      };
    }
  }, [w.threeReady, w.geomorphs?.hash]);

  React.useEffect(() => {// request nav-mesh onchange geomorphs.json or mapKey
    if (w.threeReady && w.hash) {
      w.nav.worker.postMessage({ type: "request-nav-mesh", mapKey: w.mapKey });

      w.physics.worker.postMessage({
        type: "setup-physics-world",
        mapKey: w.mapKey,
        // On HMR must provide existing npcs:
        npcs: Object.values(w.npc?.npc ?? {}).map((npc) => ({
          npcKey: npc.key,
          position: npc.getPosition(),
        })),
      });
    }
  }, [w.threeReady, w.hash]); // 🚧 avoid rebuild when only image changes

  return null;
}

if (isDevelopment()) {// propagate HMR to this file onchange worker files
  import('./physics.worker');
  import('./nav.worker');
}

/**
 * @typedef State
 * @property {(e: MessageEvent<WW.MsgFromNavWorker>) => Promise<void>} handleNavWorkerMessage
 * @property {(e: MessageEvent<WW.MsgFromPhysicsWorker>) => Promise<void>} handlePhysicsWorkerMessage
 */
