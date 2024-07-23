import React from 'react';
import { WorldContext } from './world-context';
import { isDevelopment } from '../service/generic';

/**
 * This component avoids reloading the nav-mesh e.g. on edit World.jsx
 */
export default function WorldWorkers() {

  const w = React.useContext(WorldContext);

  React.useEffect(() => {// (re)start worker on(change) geomorphs.json
    if (w.threeReady && w.hash) {
      w.nav.worker = new Worker(new URL("./nav.worker", import.meta.url), { type: "module" });
      w.nav.worker.addEventListener("message", w.handleNavWorkerMessage);
      
      w.physics.worker = new Worker(new URL("./physics.worker", import.meta.url), { type: "module" });
      w.physics.worker.addEventListener("message", w.handlePhysicsWorkerMessage);

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
        mapKey: w.mapKey, // on hmr we must provide existing npcs
        npcs: Object.values(w.npc?.npc ?? {}).map((npc) => ({
          npcKey: npc.key,
          position: npc.getPosition(),
        })),
      });
    }
  }, [w.threeReady, w.hash]);

  return null;
}

if (isDevelopment()) {
  // propagate hmr to this file onchange worker files
  import('./physics.worker');
  import('./nav.worker');
}
