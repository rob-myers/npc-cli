import React from "react";

import { mapValues, tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { DefaultContextMenu, NpcSpeechBubble } from "./context-menu";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d } from "../components/Html3d";
import { DefaultContextMenu as DefaultContextMenuUi, defaultContextMenuCss } from "./DefaultContextMenu";
import { NpcSpeechBubble as NpcSpeechBubbleUi, npcContextMenuCss } from "./NpcSpeechBubble";

/**
 * We support two kinds of context menu:
 * - default context menu, key=default, path=`w.cm`
 * - npc speech bubble, key={npcKey}, path=`w.c.lookup.{npcKey}`
 */
export default function ContextMenus() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {},

    create(npcKey) {// assumes non-existent
      if (npcKey in w.n) {
        const cm = state.lookup[npcKey] = new NpcSpeechBubble(npcKey, w, {
          showKvs: false,
          pinned: true,
        });
        cm.setTracked(w.n[npcKey].m.group);
        cm.updateOffset();
        cm.baseScale = speechBubbleBaseScale; // speech bubble always scaled
        cm.open = true;
        update();
        return cm;
      } else {
        throw Error(`ContextMenus.trackNpc: npc not found: "${npcKey}"`);
      }
    },
    delete(...npcKeys) {
      for (const npcKey of npcKeys) {
        if (npcKey === 'default') {
          continue; // cannot delete default context menu
        }
        state.lookup[npcKey]?.setTracked();
        delete state.lookup[npcKey];
      }
      update();
    },
    get(npcKey) {
      return /** @type {NpcSpeechBubble} */ (state.lookup[npcKey]);
    },
    say(npcKey, ...parts) {// ensure/change/delete
      const cm = state.get(npcKey) || state.create(npcKey);
      const speechWithLinks = parts.join(' ').trim();
      const speechSansLinks = speechWithLinks.replace(/\[ (\S+) \]/g, '$1');

      if (speechWithLinks === '') {// delete
        state.delete(npcKey);
      } else {// change
        cm.open = true;
        cm.speech = speechSansLinks;
        cm.update();
      }

      w.events.next({ key: 'speech', npcKey, speech: speechWithLinks });
    },

  }));

  w.c = state;
  w.cm = /** @type {DefaultContextMenu} */ (
    state.lookup.default ??= new DefaultContextMenu('default', w, { showKvs: true })
  );

  React.useMemo(() => {// HMR
    process.env.NODE_ENV === 'development' && Object.values(state.lookup).forEach(cm => {
      state.lookup[cm.key] = cm.key === 'default'
        ? Object.assign(new DefaultContextMenu(cm.key, cm.w, cm), {...cm})
        : Object.assign(new NpcSpeechBubble(cm.key, cm.w, cm), {...cm})
      ;
      cm.dispose();
    });
  }, []);

  const update = useUpdate();

  return Object.values(state.lookup).map(cm =>
    <MemoizedContextMenu key={cm.key} cm={cm} epochMs={cm.epochMs}/>
  );
}

/**
 * @typedef State
 * @property {{ [cmKey: string]: NPC.ContextMenuType }} lookup
 *
 * @property {(npcKey: string) => NpcSpeechBubble} create Add speech bubble for specific npc
 * @property {(...npcKeys: string[]) => void} delete
 * @property {(npcKey: string) => NpcSpeechBubble} get
 * @property {(npcKey: string, ...parts: string[]) => void} say
 */

/**
 * @param {ContextMenuProps} props
 */
function ContextMenu({ cm }) {

  cm.update = useUpdate();

  React.useEffect(() => {
    // Need extra initial render e.g. when paused
    // Also trigger CSS transition on scaled:=false
    cm.update();
  }, [cm.scaled]);

  return (
    <Html3d
      ref={cm.html3dRef.bind(cm)}
      className={cm.key === 'default' ? defaultContextMenuCss: npcContextMenuCss}
      baseScale={cm.baseScale}
      docked={cm.docked}
      position={cm.position}
      offset={cm.offset}
      open={cm.open}
      tracked={cm.tracked}
      zIndex={cm.key === 'default' ? 1 : undefined}
    >
      {cm instanceof DefaultContextMenu
        ? <DefaultContextMenuUi cm={cm} />
        : <NpcSpeechBubbleUi cm={cm} />
      }
    </Html3d>
  );
}

/**
 * @typedef ContextMenuProps
 * @property {NPC.ContextMenuType} cm
 */

/** @type {React.MemoExoticComponent<(props: ContextMenuProps & { epochMs: number }) => JSX.Element>} */
const MemoizedContextMenu = React.memo(ContextMenu);

const speechBubbleBaseScale = 4;
