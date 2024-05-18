import React from "react";
import { warn } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./TestWorld').State} api
 */
export default function useHandleEvents(api) {
  const state = useStateRef(/** @returns {State} */ () => ({
    handleEvents(e) {
      switch (e.key) {
        case "pointerup": 
          e.is3d && state.onPointerUp3d(e);
          break;
        case "draw-floor-ceil":
          if (!api.floorImg[e.gmKey]) {// 🚧 eliminate
            return warn(`saw "${e.key}" before api.floorImg['${e.gmKey}']`);
          }
          api.surfaces.drawFloorAndCeil(e.gmKey);
          break;
      }
    },
    onPointerUp3d(e) {
      if (e.meta.floor === true) {
        if (!api.npcs) {// 🚧 eliminate
          return warn(`saw "${e.key}" before api.npcs`);
        }
        if (!e.rmb && !e.justLongDown && e.distancePx < 1) {
          api.walkTo(e.point);
        }
      }

      if (e.meta.doors === true) {
        if (!e.rmb && !e.justLongDown) {
          const instanceId = /** @type {number} */ (e.meta.instanceId);
          api.doors.toggleDoor(instanceId);
        }
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
 * @property {(e: NPC.PointerUpEvent & { is3d: true }) => void} onPointerUp3d
 */
