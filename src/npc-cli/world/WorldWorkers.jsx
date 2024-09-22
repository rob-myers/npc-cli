import React from 'react';
import { init as initRecastNav } from "@recast-navigation/core";

import { isDevelopment, warn, debug, testNever } from '../service/generic';
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
    seenHash: /** @type {*} */ ({}),

    async handleNavWorkerMessage(e) {
      const msg = e.data;
      // 🔔 avoid logging navMesh to save memory
      debug("main thread received from nav worker", msg.type);
      if (msg.type === "nav-mesh-response") {
        await initRecastNav();
        w.loadTiledMesh(msg.exportedNavMesh);
        w.update(); // for w.npc
      }
    },

    handlePhysicsCollision(npcKey, otherKey, isEnter) {
      const [type, subKey] = state.parsePhysicsBodyKey(otherKey);

      if (type === 'npc') {
        warn(`${'handlePhysicsCollision'}: unexpected otherKey: "${otherKey}"`);
      } else {
        w.events.next({ key: isEnter === true ? 'enter-collider' : 'exit-collider', npcKey,
          ...(type === 'inside' || type === 'nearby') 
            ? { type, ...w.lib.getGmDoorId(subKey) }
            : { type, colliderKey: subKey }
        });
      }
    },

    async handlePhysicsWorkerMessage(e) {
      const msg = e.data;
      debug("main thread received from physics worker", msg);

      if (msg.type === "npc-collisions") {
        msg.collisionEnd.forEach(({ npcKey, otherKey }) => {
          state.handlePhysicsCollision(npcKey, otherKey, false);
        });
        msg.collisionStart.forEach(({ npcKey, otherKey }) => {
          state.handlePhysicsCollision(npcKey, otherKey, true);
        });
      }
    },
    parsePhysicsBodyKey(bodyKey) {
      return /** @type {*} */ (
        bodyKey.split(' ')
      );
    },
  }));

  React.useEffect(() => {// restart worker onchange geomorphs.json
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
  }, [w.threeReady, w.hash.full]);

  React.useEffect(() => {// request nav-mesh onchange geomorphs.json or mapKey
    if (w.threeReady && w.hash.full) {

      const prev = state.seenHash;
      const next = w.hash;
      const changedGmIds = w.gms.map(({ key }, gmId) =>
        next[key].nav !== prev[key]?.nav // geomorph changed
        || next.gmHashes[gmId] !== prev.gmHashes[gmId] // geomorph instance changed
      );
      
      w.events.next({ key: 'pre-request-nav', changedGmIds });
      w.nav.worker.postMessage({ type: "request-nav-mesh", mapKey: w.mapKey });

      w.events.next({ key: 'pre-setup-physics' });
      w.physics.worker.postMessage({
        type: "setup-physics-world",
        mapKey: w.mapKey, // On HMR must provide existing npcs:
        npcs: Object.values(w.npc?.npc ?? {}).map((npc) => ({
          npcKey: npc.key,
          position: npc.getPosition(),
        })),
      });

      state.seenHash = next;
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
 * @property {Geomorph.GeomorphsHash} seenHash
 * @property {(e: MessageEvent<WW.MsgFromNavWorker>) => Promise<void>} handleNavWorkerMessage
 * @property {(npcKey: string, otherKey: WW.PhysicsBodyKey, isEnter?: boolean) => void} handlePhysicsCollision
 * @property {(e: MessageEvent<WW.MsgFromPhysicsWorker>) => Promise<void>} handlePhysicsWorkerMessage
 * @property {(key: WW.PhysicsBodyKey) => (
 *   | ['npc' | 'circle' | 'rect', string]
 *   | ['nearby' | 'inside', Geomorph.GmDoorKey]
 * )} parsePhysicsBodyKey
 */
