import React from 'react';
import { init as initRecastNav } from "@recast-navigation/core";

import { isDevelopment, warn, debug, testNever } from '../service/generic';
import { parsePhysicsBodyKey } from '../service/rapier';
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
      debug(`main thread received "${msg.type}" from 🤖 nav.worker`);
      // console.log(msg);

      if (msg.type === "nav-mesh-response") {
        w.menu.measure('request-nav');
        await initRecastNav();
        w.loadTiledMesh(msg.exportedNavMesh, msg.offMeshLookup);
        w.update(); // for w.npc
        w.events.next({ key: 'nav-updated' });
      }
    },

    handlePhysicsCollision(npcKey, otherKey, isEnter) {
      const [type, subKey] = parsePhysicsBodyKey(otherKey);

      if (type === 'npc') {
        warn(`${'handlePhysicsCollision'}: unexpected otherKey: "${otherKey}"`);
      } else {
        w.events.next({ key: isEnter === true ? 'enter-collider' : 'exit-collider', npcKey,
          ...(type === 'inside' || type === 'nearby') 
            ? { type, ...w.lib.getGmDoorId(subKey) }
            : { type, decorKey: subKey }
        });
      }
    },

    async handlePhysicsWorkerMessage({ data: msg }) {
      debug(`main thread received "${msg.type}" from 🤖 physics.worker`, msg);

      if (msg.type === "npc-collisions") {
        msg.collisionEnd.forEach(({ npcKey, otherKey }) => {
          if (otherKey === undefined) {
            warn(`${npcKey}: ${'handlePhysicsWorkerMessage'} collider removed whilst colliding`);
            return;
          }
          state.handlePhysicsCollision(npcKey, otherKey, false);
        });
        msg.collisionStart.forEach(({ npcKey, otherKey }) => {
          state.handlePhysicsCollision(npcKey, otherKey, true);
        });
        return;
      }

      if (msg.type === 'physics-is-setup') {
        w.physics.rebuilds++;
        w.menu.measure('setup-physics');
      }
    },
  }));

  React.useEffect(() => {// restart workers
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

  React.useEffect(() => {// request nav-mesh, fresh physics world
    if (w.threeReady && w.hash.full) {

      const prev = state.seenHash;
      const next = w.hash;
      const changedGmIds = w.gms.map(({ key }, gmId) =>
        next[key].nav !== prev[key]?.nav // geomorph changed
        || next.mapGmHashes[gmId] !== prev.mapGmHashes[gmId] // geomorph instance changed
      );
      
      w.events.next({ key: 'pre-request-nav', changedGmIds });
      w.menu.measure('request-nav');
      w.nav.worker.postMessage({ type: "request-nav", mapKey: w.mapKey });

      w.events.next({ key: 'pre-setup-physics' });
      w.menu.measure('setup-physics');
      w.physics.worker.postMessage({
        type: "setup-physics",
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
 */
