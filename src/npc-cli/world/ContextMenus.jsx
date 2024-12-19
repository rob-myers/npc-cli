import React from "react";

import { mapValues, tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { CMInstance } from "./cm-instance";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d } from "../components/Html3d";
import { DefaultContextMenu, defaultContextMenuCss, NpcContextMenu, npcContextMenuCss } from "./ContextMenuUi";

/**
 * We support two kinds of context menu:
 * - default context menu (key `default`) a.k.a. `w.cm`
 * - npc speech bubbles (keys `@{npcKey}`)
 */
export default function ContextMenus() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {},
    savedOpts: tryLocalStorageGetParsed(`context-menus@${w.key}`) ?? {},

    create(npcKey) {
      if (npcKey in w.n) {
        const cmKey = w.lib.npcKeyToCmKey(npcKey);
        const cm = state.lookup[cmKey] ??= new CMInstance(cmKey, w, { showKvs: false, pinned: true, npcKey });
        cm.setTracked(w.n[npcKey].m.group);
        cm.open = true;
        update();
      } else {
        throw Error(`ContextMenus.trackNpc: npc not found: "${npcKey}"`);
      }
    },
    delete(...npcKeys) {
      for (const npcKey of npcKeys) {
        const cmKey = w.lib.npcKeyToCmKey(npcKey);
        state.lookup[cmKey]?.setTracked();
        delete state.lookup[cmKey];
      }
      update();
    },
    get(npcKey) {
      return this.lookup[w.lib.npcKeyToCmKey(npcKey)];
    },
    saveOpts() {// only need to save default?
      tryLocalStorageSet(`context-menus@${w.key}`, JSON.stringify(
        mapValues(state.lookup, ({ pinned, showKvs, docked }) => ({ pinned, showKvs, docked }))
      ));
    },

  }));

  w.c = state;
  w.cm = state.lookup.default ??= new CMInstance('default', w, { showKvs: true });

  React.useMemo(() => {// HMR
    process.env.NODE_ENV === 'development' && Object.values(state.lookup).forEach(cm => {
      state.lookup[cm.key] = Object.assign(new CMInstance(cm.key, cm.w, cm.ui), {...cm});
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
 * @property {{ [cmKey: string]: CMInstance }} lookup
 * @property {{ [cmKey: string]: Pick<CMInstance, 'docked' | 'pinned' | 'showKvs'> }} savedOpts
 *
 * @property {(npcKey: string) => void} create Add speech bubble for specific npc
 * @property {(...cmKeys: string[]) => void} delete
 * @property {(npcKey: string) => void} get Get npc speech bubble
 * @property {() => void} saveOpts
 */

/** @type {React.MemoExoticComponent<(props: ContextMenuProps & { epochMs: number }) => JSX.Element>} */
const MemoizedContextMenu = React.memo(ContextMenu);

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
      normal={cm.normal}
      open={cm.open}
      tracked={cm.tracked}
      zIndex={cm.key === 'default' ? 1 : undefined}
    >
      {cm.key === 'default'
        ? <DefaultContextMenu cm={cm} />
        : <NpcContextMenu cm={cm} />
      }
    </Html3d>
  );
}

/**
 * @typedef ContextMenuProps
 * @property {CMInstance} cm
 */
