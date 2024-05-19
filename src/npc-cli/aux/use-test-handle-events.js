import React from "react";
import { warn } from "../service/generic";
import { isTouchDevice } from "../service/dom";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./TestWorld').State} api
 */
export default function useHandleEvents(api) {
  const state = useStateRef(/** @returns {State} */ () => ({
    handleEvents(e) {
      switch (e.key) {
        case "draw-floor-ceil":
          if (!api.floorImg[e.gmKey]) {// 🚧 eliminate
            return warn(`saw "${e.key}" before api.floorImg['${e.gmKey}']`);
          }
          api.surfaces.drawFloorAndCeil(e.gmKey);
          break;
        case "long-pointerdown":
          if (e.distancePx <= (isTouchDevice() ? 10 : 5)) {// mobile/desktop show/hide ContextMenu
            api.menu.show({ x: Math.max(0, e.screenPoint.x - 64), y: Math.max(0, e.screenPoint.y - 64) });
            // 🚧 prevent pan
          } else {
            api.menu.hide();
          }
          break;
        case "pointerdown":
          api.menu.hide();
          break;
        case "pointerup":
          e.is3d && state.onPointerUp3d(e);
          state.handleMenuPointerUp(e);
          break;
        case "pointerup-outside":
          state.handleMenuPointerUp(e);
          break;
      }
    },
    handleMenuPointerUp(e) {
      if (!isTouchDevice()) {// Desktop
        if (e.rmb && e.distancePx <= 5) {
          api.menu.show({ x: Math.max(0, e.screenPoint.x - 64), y: Math.max(0, e.screenPoint.y - 64) });
        } else {
          api.menu.hide();
        }
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
 * @property {(e: NPC.PointerUpEvent | NPC.PointerUpOutsideEvent) => void} handleMenuPointerUp
 * @property {(e: NPC.PointerUpEvent & { is3d: true }) => void} onPointerUp3d
 */
