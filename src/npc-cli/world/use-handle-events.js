import React from "react";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./World').State} w
 */
export default function useHandleEvents(w) {
  const state = useStateRef(/** @returns {State} */ () => ({
    doorToNearby: {},
    npcToAccess: {},
    npcToNearby: {},

    handleEvents(e) {
      // info('useTestHandleEvents', e);

      if ('npcKey' in e) {
        return state.handleNpcEvents(e);
      }

      switch (e.key) {
        case "changed-zoom":
          w.ceil.thickerTops = e.level === 'far';
          w.ceil.draw();
          break;
        case "long-pointerdown":
          // mobile/desktop show/hide ContextMenu
          if (e.distancePx <= (e.touch ? 10 : 5)) {
            w.menu.show({ x: e.screenPoint.x - 128, y: e.screenPoint.y });
            // prevent pan whilst pointer held down
            w.ui.controls.saveState();
            w.ui.controls.reset();
          } else {
            w.menu.hide();
          }
          break;
        case "pointerdown":
          w.ui.setLastDown(e);
          w.menu.hide();
          break;
        case "pointerup":
          e.is3d && !w.menu.justOpen && state.onPointerUp3d(e);
          !e.touch && state.onPointerUpMenuDesktop(e);
          w.menu.justOpen = w.menu.isOpen;
          break;
        case "pointerup-outside":
          !e.touch && state.onPointerUpMenuDesktop(e);
          break;
        case "decor-instantiated":
          w.setReady();
          break;
      }
    },
    handleNpcEvents(e) {
      switch (e.key) {
        case "entered-sensor": {
          const door = w.door.byKey[e.gdKey];
          (state.npcToNearby[e.npcKey] ??= new Set).add(e.gdKey);
          (state.doorToNearby[e.gdKey] ??= new Set).add(e.npcKey);
          
          // 🚧 can force open
          if (door.auto === true) {
          // if (true) {
            w.door.toggle({ gdKey: e.gdKey, open: true });
          }
          break;
        }
        case "exited-sensor": {
          const door = w.door.byKey[e.gdKey];
          state.npcToNearby[e.npcKey]?.delete(e.gdKey);
          state.doorToNearby[e.gdKey]?.delete(e.npcKey);
          break;
        }
        case "spawned": {
          const npc = w.npc.npc[e.npcKey];
          if (npc.s.spawns === 1) {// 1st spawn
            const { x, y, z } = npc.getPosition();
            w.physics.worker.postMessage({
              type: 'add-npcs',
              npcs: [{ npcKey: e.npcKey, position: { x, y, z } }],
            });
          }
          break;
        }
        case "removed-npc":
          w.physics.worker.postMessage({
            type: 'remove-npcs',
            npcKeys: [e.npcKey],
          });
          state.removeFromSensors(e.key);
          break;
      }
    },
    onPointerUpMenuDesktop(e) {
      if (e.rmb && e.distancePx <= 5) {
        w.menu.show({ x: e.screenPoint.x + 12, y: e.screenPoint.y });
      } else if (!e.justLongDown) {
        w.menu.hide();
      }
    },
    onPointerUp3d(e) {
      if (e.rmb === true || e.justLongDown === true || e.pointers !== 1) {
        return;
      }
      if (e.distancePx > (e.touch === true ? 5 : 1)) {
        return;
      }
    },
    removeFromSensors(npcKey) {
      for (const gdKey of state.npcToNearby[npcKey] ?? []) {
        const door = w.door.byKey[gdKey];
        state.doorToNearby[gdKey].delete(npcKey);
        if (door.auto === true && state.doorToNearby[gdKey].size === 0) {
          w.door.tryCloseDoor(door.gmId, door.doorId);
        }
      }
      state.npcToNearby[npcKey]?.clear();
    },
  }));
  
  w.s = state; // s for 'shared'

  React.useEffect(() => {
    const sub = w.events.subscribe(state.handleEvents);
    return () => {
      sub.unsubscribe();
    };
  }, []);
}

/**
 * @typedef State
 * @property {{ [gdKey: Geomorph.GmDoorKey]: Set<string> }} doorToNearby
 * Relates `Geomorph.GmDoorKey` to nearby `npcKey`s
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Relates `npcKey` to prefixes of accessible `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: Set<Geomorph.GmDoorKey> }} npcToNearby
 * Relates `npcKey` to nearby `Geomorph.GmDoorKey`s
 *
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(e: NPC.PointerUpEvent | NPC.PointerUpOutsideEvent) => void} onPointerUpMenuDesktop
 * @property {(e: NPC.PointerUpEvent & { is3d: true }) => void} onPointerUp3d
 * @property {(npcKey: string) => void} removeFromSensors
 */
