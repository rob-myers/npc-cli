import React from "react";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./TestWorld').State} api
 */
export default function useHandleEvents(api) {
  const state = useStateRef(/** @returns {State} */ () => ({
    handleEvents(e) {
      switch (e.key) {
        case "pointerup":
          e.distance < 1 && api.walkTo(e.point);
          break;
      }
    },
  }));

  React.useEffect(() => {
    if (!api.threeReady) {
      return;
    }
    const sub = api.events.subscribe(state.handleEvents);
    return () => {
      sub.unsubscribe();
    };
  }, [api.threeReady]);
}

/**
 * @typedef State
 * @property {(e: NPC.Event) => void} handleEvents
 */
