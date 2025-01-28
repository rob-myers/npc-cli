import React from "react";
import { css, cx } from "@emotion/css";
import { stringify as javascriptStringify } from 'javascript-stringify';
import debounce from "debounce";

import { tryLocalStorageGetParsed, tryLocalStorageSet, warn } from "../service/generic";
import { WorldContext } from "./world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import { PopUp, popUpContentClassName } from "../components/PopUp";
import { Html3d, objectScale } from "../components/Html3d";
import { Draggable } from "../components/Draggable";

export function ContextMenu() {

  const w = React.useContext(WorldContext);
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    baseScale: undefined,
    docked: false,
    draggable: null,
    /** For violating React.memo */
    epochMs: 0,
    position: [0, 0, 0],
    tracked: undefined,
    offset: undefined,
    open: false,
    html3d: /** @type {*} */ (null),

    pinned: tryLocalStorageGetParsed(`context-menu:pinned@${w.key}`) ?? w.smallViewport,
    scaled: false,
    showKvs: true,
  
    kvs: [],
    innerRoot: /** @type {*} */ (null),
    links: [],
    match: {},
    meta: {},
    npcKey: undefined,
    popUp: /** @type {*} */ (null),
    selectNpcKeys: [],

    downAt: null,

    computeKvsFromMeta(meta) {
      const skip = /** @type {Record<string, boolean>} */ ({
        doorId: 'gdKey' in meta,
        gmId: 'gdKey' in meta || 'grKey' in meta,
        obsId: true,
        picked: true,
        roomId: 'grKey' in meta,
      });
      state.kvs = Object.entries(meta ?? {}).flatMap(([k, v]) => {
        if (skip[k] === true) return [];
        const vStr = v === true ? '' : typeof v === 'string' ? v : javascriptStringify(v) ?? '';
        return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
      }).sort((a, b) => a.length < b.length ? -1 : 1);
    },
    /**
     * Apply matchers, assuming `state.meta` is up-to-date.
     */
    computeLinks() {
      let suppressKeys = /** @type {string[]} */ ([]);
      const keyToLink = Object.values(state.match).reduce((agg, matcher) => {
        const { showLinks, hideKeys } = matcher(state);
        showLinks?.forEach(link => agg[link.key] = link);
        suppressKeys.push(...hideKeys ?? []);
        return agg;
      }, /** @type {{ [linkKey: string]: NPC.ContextMenuLink }} */ ({}));
      
      suppressKeys.forEach(key => delete keyToLink[key]);
      state.links = Object.values(keyToLink);
    },
    hide(force) {
      if (state.pinned === true && force !== true) {
        return;
      }
      state.open = false;
      update();
    },
    onKeyDownButton(e) {
      if (e.code === 'Space') {
        state.onToggleLink(e);
        e.currentTarget.focus();
      }
    },
    onPointerDown(e) {
      state.downAt = { x: e.clientX, y: e.clientY };
    },
    onPointerUp(e) {
      const { downAt } = state;
      state.downAt = null;

      if (
        downAt === null
        || Math.abs(e.clientX - downAt.x) > 2
        || Math.abs(e.clientY - downAt.y) > 2
      ) {
        return;
      } else {
        state.onToggleLink(e);
      }
    },
    onSelectNpc(e) {
      const { value } = e.currentTarget;
      state.npcKey = value in w.n ? value : undefined;
      state.refreshPopUp();
    },
    onToggleLink(e) {
      const el = /** @type {HTMLElement} */ (e.target);
      const linkKey = el.dataset.key;

      if (linkKey === undefined) {
        return warn(`${'onToggleLink'}: ignored el ${el.tagName} with class ${el.className}`);
      }

      // w.view.rootEl.focus();
      w.events.next({ key: 'click-link', cmKey: 'default', linkKey });

      switch (linkKey) {
        // case 'delete': w.c.delete(e.cmKey); break;
        case 'clear-npc': state.setNpc(); break;
        case 'hide': state.hide(true); break;
        case 'toggle-docked': state.toggleDocked(); break;
        case 'toggle-kvs': state.toggleKvs(); break;
        case 'toggle-pinned': state.togglePinned(); break;
        case 'toggle-scaled': state.toggleScaled(); break;
      }

      w.cm.persist();
      update();
    },
    onTogglePopup(willOpen) {
      if (willOpen) {
        state.refreshPopUp();
      }
    },
    persist() {
      tryLocalStorageSet(`context-menu:pinned@${w.key}`, JSON.stringify(state.pinned));
    },
    refreshPopUp: debounce(() => {
      state.selectNpcKeys = Object.keys(w.n);
      update();
    }, 30, { immediate: true }),
    /**
     * Context is world position and meta concerning said position
     */
    setContext({ position, meta }) {
      state.meta = meta;
      state.position = position.toArray();
      state.computeKvsFromMeta(meta);
      state.computeLinks();
    },
    setNpc(npcKey) {
      state.npcKey = npcKey;
      update();
    },
    setOpacity(opacity) {
      state.html3d.rootDiv.style.opacity = `${opacity}`;
    },
    setTracked(input) {
      state.tracked = input;
    },
    show() {
      state.open = true;
      update();
    },
    toggleDocked() {
      state.docked = !state.docked
      if (state.docked === true) {// About to dock
        state.popUp.close();
        setTimeout(() => state.draggable?.updatePos(), 30);
      }
    },
    togglePinned() {
      state.pinned = !state.pinned;
      if (state.pinned === false) {
        state.open = false; // auto-close on un-pin
      }
    },
    /** Ensure smooth transition when start scaling */
    toggleScaled() {
      state.scaled = !state.scaled;
      state.baseScale = state.scaled === true ? 1 / objectScale(state.html3d.objTarget, w.r3f.camera) : undefined;
    },
    toggleKvs() {
      state.showKvs = !state.showKvs;
    },
  }));

  w.cm = state;
  
  // Extra initial render: (a) init paused, (b) trigger CSS transition
  React.useEffect(() => void update(), [state.scaled]);

  return (
    <Html3d
      ref={state.ref('html3d')}
      baseScale={state.baseScale}
      className={contextMenuCss}
      docked={state.docked}
      open={state.open}
      position={state.position}
      tracked={state.tracked}
    >
      {state.docked === true ? (
        <Draggable
          ref={state.ref('draggable')}
          container={w.view.rootEl}
          initPos={{ x: 0, y: 2000 }}
          localStorageKey={`contextmenu:dragPos@${w.key}`}
          observeSizes={[state.innerRoot]}
        >
          <ContextMenuUi state={state} />
        </Draggable>
      ) : (
        <ContextMenuUi state={state} />
      )}
    </Html3d>
  );

}

/** @param {{ state: import("../hooks/use-state-ref").UseStateRef<State> }} _ */
function ContextMenuUi({ state: cm }) {
  return <div
    className="inner-root"
    ref={cm.ref('innerRoot')}
    onPointerUp={cm.onPointerUp}
    onPointerDown={cm.onPointerDown}
  >
    <div className="links">

      <button
        data-key="toggle-docked"
        onKeyDown={cm.onKeyDownButton}
      >
        {cm.docked ? 'embed' : 'dock'}
      </button>

      <PopUp
        ref={cm.ref('popUp')}
        className={popUpInfoCss}
        label="opts"
        onChange={cm.onTogglePopup.bind(cm)}
        width={200}
      >
        <select
          className="select-npc"
          onChange={cm.onSelectNpc.bind(cm)}
          value={cm.npcKey ?? ""}
        >
          <option value="">no npc</option>
          {cm.selectNpcKeys.map(npcKey => 
            <option key={npcKey} value={npcKey}>{npcKey}</option>
          )}
        </select>

        <button
          key="toggle-scaled"
          data-key="toggle-scaled"
          className={!cm.scaled ? 'off' : undefined}
        >
          scale
        </button>
      </PopUp>

      <button
        key="toggle-kvs"
        data-key="toggle-kvs"
        className={!cm.showKvs ? 'off' : undefined}
        onKeyDown={cm.onKeyDownButton}
      >
        meta
      </button>

      <button
        key="toggle-pinned"
        data-key="toggle-pinned"
        className={!cm.pinned ? 'off' : undefined}
        onKeyDown={cm.onKeyDownButton}
      >
        pin
      </button>

      {cm.links.map(({ key, label, test }) =>
        <button
          key={key}
          data-key={key}
          className={test !== undefined && !(/** @type {*} */ (cm)[test]) ? 'off' : undefined}
        >
          {label}
        </button>
      )}
    </div>

    {cm.showKvs === true && <div className="kvs">
      {cm.kvs.map(x => <>
        <span key={x.k} className="key">{x.k}</span>
        {x.v !== '' && <span key={`${x.k},${x.v}`} className="value">{x.v}</span>}
      </>)}
    </div>}
  </div>;
}

export const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  background: transparent !important;
  pointer-events: none;
  opacity: 0.8;

  > div {
    transform-origin: 0 0;
    pointer-events: all;

    .inner-root {
      width: 200px;
      background-color: #000;
      border-radius: 0 8px 8px 8px;
      border: 1px solid #333;
      padding: 4px;
      font-size: small;
    }
  }

  z-index: 3; // in front of Logger

  &.docked {
    transform: unset !important;
  }

  .select-npc {
    background-color: black;
    color: white;
    padding: 4px;
  }

  color: #fff;
  letter-spacing: 1px;
  font-size: smaller;

  .links {
    display: flex;
    flex-wrap: wrap;
    
    line-height: normal;
    gap: 0px;
  }

  .links button {
    text-decoration: underline;
    color: #aaf;
    padding: 5px 6px;
  }
  .links button.off {
    filter: brightness(0.7);
  }

  .kvs {
    display: flex;
    flex-wrap: wrap;
    user-select: text;

    padding: 4px;
    gap: 4px;
    color: #ccc;
    filter: brightness(0.7);

    span.value {
      color: #ff7;
    }
  }

`;

const popUpInfoCss = css`
  .${popUpContentClassName} {
    display: flex;
    justify-content: space-around;
    align-items: center;
    font-size: small;
  
    select {
      border: 1px solid #555;
    }
  }
;`

/**
 * @typedef {{
 *   baseScale: undefined | number;
 *   docked: boolean;
 *   draggable: null | import('../components/Draggable').State;
 *   epochMs: number;
 *   html3d: import("../components/Html3d").State;
 *   innerRoot: HTMLElement;
 *   downAt: null | Geom.VectJson;
 *   kvs: { k: string; v: string; length: number }[];
 *   links: NPC.ContextMenuLink[];
 *   match: { [matcherKey: string]: NPC.ContextMenuMatcher };
 *   meta: Geom.Meta;
 *   npcKey: undefined | string;
 *   offset: undefined | import("three").Vector3Like;
 *   open: boolean;
 *   popUp: import("../components/PopUp").State;
 *   position: [number, number, number];
 *   tracked: undefined | import("three").Object3D;
 *   pinned: boolean;
 *   scaled: boolean;
 *   selectNpcKeys: string[];
 *   showKvs: boolean;
 *   computeKvsFromMeta(meta: Geom.Meta): void;
 *   computeLinks(): void;
 *   hide(force?: boolean | undefined): void;
 *   onKeyDownButton(e: React.KeyboardEvent<HTMLButtonElement>): void;
 *   onPointerDown(e: React.PointerEvent): void;
 *   onPointerUp(e: React.PointerEvent): void;
 *   onToggleLink(e: React.MouseEvent | React.KeyboardEvent): void;
 *   onSelectNpc(e: React.ChangeEvent<HTMLSelectElement>): void;
 *   onTogglePopup(willOpen: boolean): void;
 *   persist(): void;
 *   refreshPopUp(): void;
 *   setContext({ position, meta }: NPC.ContextMenuContextDef): void;
 *   setNpc(npcKey?: string | undefined): void;
 *   setOpacity(opacity: number): void;
 *   setTracked(input?: import('three').Object3D): void;
 *   show(): void;
 *   toggleDocked(): void;
 *   togglePinned(): void;
 *   toggleScaled(): void;
 *   toggleKvs(): void;
 * }} State
 **/
