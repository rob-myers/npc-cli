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
        case "draw-floor-ceil":
          if (!api.floorImg[e.gmKey]) {// 🚧 eliminate
            return warn(`saw "${e.key}" before api.floorImg['${e.gmKey}']`);
          }
          api.surfaces.drawFloorAndCeil(e.gmKey);
          break;
        case "long-pointerdown":
          if (e.distancePx <= (e.touch ? 10 : 5)) {// mobile/desktop show/hide ContextMenu
            api.menu.show({ x: e.screenPoint.x + 32, y: e.screenPoint.y });
            // prevent pan whilst pointer held down
            api.view.controls.saveState();
            api.view.controls.reset();
          } else {
            api.menu.hide();
          }
          break;
        case "pointerdown":
          api.view.setLastDown(e);
          api.menu.hide();
          break;
        case "pointerup":
          e.is3d && !api.menu.justOpen && state.onPointerUp3d(e);
          !e.touch && state.onPointerUpMenuDesktop(e);
          api.menu.justOpen = api.menu.isOpen;
          break;
        case "pointerup-outside":
          !e.touch && state.onPointerUpMenuDesktop(e);
          break;
      }
    },
    onPointerUpMenuDesktop(e) {
      if (e.rmb && e.distancePx <= 5) {
        api.menu.show({ x: e.screenPoint.x + 32, y: e.screenPoint.y });
      } else if (!e.justLongDown) {
        api.menu.hide();
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
 * @property {(e: NPC.PointerUpEvent | NPC.PointerUpOutsideEvent) => void} onPointerUpMenuDesktop
 * @property {(e: NPC.PointerUpEvent & { is3d: true }) => void} onPointerUp3d
 */
