import React from "react";
import { warn, info } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import { crowdAgentParams } from "./create-npc";

/**
 * @param {import('./TestWorld').State} api
 */
export default function useTestHandleEvents(api) {
  const state = useStateRef(/** @returns {State} */ () => ({
    handleEvents(e) {
      info('useTestHandleEvents', e);

      switch (e.key) {
        case "draw-floor-ceil":
          if (!api.floorImg[e.gmKey]) {// 🚧 eliminate
            return warn(`saw "${e.key}" before api.floorImg['${e.gmKey}']`);
          }
          api.flat.drawFloorAndCeil(e.gmKey);
          break;
        case "long-pointerdown":
          if (e.distancePx <= (e.touch ? 10 : 5)) {// mobile/desktop show/hide ContextMenu
            api.menu.show({ x: e.screenPoint.x - 128, y: e.screenPoint.y });
            // prevent pan whilst pointer held down
            api.ui.controls.saveState();
            api.ui.controls.reset();
          } else {
            api.menu.hide();
          }
          break;
        case "pointerdown":
          api.ui.setLastDown(e);
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
        api.menu.show({ x: e.screenPoint.x + 12, y: e.screenPoint.y });
      } else if (!e.justLongDown) {
        api.menu.hide();
      }
    },
    onPointerUp3d(e) {
      if (e.rmb === true || e.justLongDown === true || e.pointers !== 1) {
        return;
      }
      if (e.distancePx > (e.touch === true ? 5 : 1)) {
        return;
      }

      if (e.meta.floor === true) {
        const npc = api.npc?.getSelected(); // api.npc may not exist yet
        if (npc) {
          npc.s.run = e.modifierKey;
          npc.agent?.setParameters({ ...crowdAgentParams,
            maxSpeed: npc.getMaxSpeed(),
          });
          npc.walkTo(e.point);
        }
      }

      if (e.meta.doors === true) {
        const instanceId = /** @type {number} */ (e.meta.instanceId);
        api.vert.toggleDoor(instanceId);
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
