import React from 'react';
import { WorldContext } from './world-context';

/**
 * This component avoids reloading the nav-mesh e.g. on edit World.jsx
 */
export default function WorldWorkers() {

  const state = React.useContext(WorldContext);

  React.useEffect(() => {// (re)start worker on(change) geomorphs.json
    if (state.threeReady && state.hash) {
      state.navWorker = new Worker(new URL("./recast.worker", import.meta.url), { type: "module" });
      state.navWorker.addEventListener("message", state.handleNavWorkerMessage);
      
      state.physicsWorker = new Worker(new URL("./rapier.worker", import.meta.url), { type: "module" });
      state.physicsWorker.addEventListener("message", state.handlePhysicsWorkerMessage);

      return () => {
        state.navWorker.terminate();
        state.physicsWorker.terminate();
      };
    }
  }, [state.threeReady, state.geomorphs?.hash]);

  React.useEffect(() => {// request nav-mesh onchange geomorphs.json or mapKey
    if (state.threeReady && state.hash) {
      state.navWorker.postMessage({ type: "request-nav-mesh", mapKey: state.mapKey });
      state.physicsWorker.postMessage({ type: "setup-rapier-world", mapKey: state.mapKey });
    }
  }, [state.threeReady, state.hash]);

  return null;
}
