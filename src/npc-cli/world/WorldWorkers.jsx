import React from 'react';
import { init as initRecastNav } from "@recast-navigation/core";

import { info, isDevelopment, warn } from '../service/generic';
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
          const [type, subKey] = state.parsePhysicsBodyKey(otherKey);
          if (type === 'npc') {
            return warn(`${'handlePhysicsWorkerMessage'}: unexpected otherKey: "${otherKey}"`);
          }
          // handle inside/nearby
          w.events.next({ key: 'exit-sensor', npcKey, type, ...w.lib.getGmDoorId(subKey) });
        });
        msg.collisionStart.forEach(({ npcKey, otherKey }) => {
          const [type, subKey] = state.parsePhysicsBodyKey(otherKey);
          if (type === 'npc') {
            return warn(`${'handlePhysicsWorkerMessage'}: unexpected otherKey: "${otherKey}"`);
          }
          // handle inside/nearby
          w.events.next({ key: 'enter-sensor', npcKey, type, ...w.lib.getGmDoorId(subKey) });
        });
      }
    },
    parsePhysicsBodyKey(bodyKey) {
      return /** @type {*} */ (
        bodyKey.split(' ')
      );
    },
  }));

  React.useEffect(() => {// (re)start worker on(change) geomorphs.json
    if (w.threeReady && w.hash.full) {
      w.nav.worker = new Worker(new URL("./nav.worker", import.meta.url), { type: "module" });
      w.nav.worker.addEventListener("message", state.handleNavWorkerMessage);
      
      w.physics.worker = new Worker(new URL("./physics.worker", import.meta.url), { type: "module" });
      w.physics.worker.addEventListener("message", state.handlePhysicsWorkerMessage);

      return () => {
        w.nav.worker.terminate();
        w.physics.worker.terminate();
      };
    }
  }, [w.threeReady, w.geomorphs?.hash.full]);

  React.useEffect(() => {// request nav-mesh onchange geomorphs.json or mapKey
    if (w.threeReady && w.hash.full) {
      // 🚧 gmKey hashes
      w.events.next({ key: 'pre-request-nav' });
      w.nav.worker.postMessage({ type: "request-nav-mesh", mapKey: w.mapKey });

      w.events.next({ key: 'pre-setup-physics' });
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
  }, [w.threeReady, w.mapKey, w.hash.full]); // 🚧 avoid rebuild when only image changes

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
 * @property {(key: WW.PhysicsBodyKey) => (
 *   | ['npc', string]
 *   | ['nearby' | 'inside', Geomorph.GmDoorKey]
 * )} parsePhysicsBodyKey
 */
