import React from "react";
import { info, warn } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./TestWorld').State} api
 */
export default function useHandleEvents(api) {
  const state = useStateRef(/** @returns {State} */ () => ({
    handleEvents(e) {
      switch (e.key) {
        case "pointerup":
          if (!api.npcs)
            return warn('saw "pointerup" before api.npcs');
          if (e.rmb || e.justLongDown || e.distancePx >= 1)
            return;
          api.walkTo(e.point);
          break;
        case "draw-floor-ceil":
          if (!api.floorImg[e.gmKey])
            return warn(`saw "draw-floor-ceil" before api.floorImg['${e.gmKey}']`);
          api.surfaces.drawFloorAndCeil(e.gmKey);
          break;
      }
    },
  }));

  React.useEffect(() => {
    const sub = api.events.subscribe(state.handleEvents);
    return () => {
      sub.unsubscribe();
    };
  }, []);
}

/**
 * @typedef State
 * @property {(e: NPC.Event) => void} handleEvents
 */
