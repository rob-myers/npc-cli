import React from "react";
import { css, cx } from "@emotion/css";
import { stringify as javascriptStringify } from 'javascript-stringify';
import debounce from "debounce";

import { tryLocalStorageGetParsed, tryLocalStorageSet, warn } from "../service/generic";
import { Vect } from "../geom";
import { WorldContext } from "./world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import { PopUp } from "../components/PopUp";
import { Html3d, objectScale } from "../components/Html3d";
import { Draggable } from "../components/Draggable";

export function ContextMenu() {

  const w = React.useContext(WorldContext);
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    baseScale: /** @type {undefined | number} */ (undefined),
    docked: false,
    draggable: null,
    /** For violating React.memo */
    epochMs: 0,
    everDocked: false,
    position: /** @type {[number, number, number]} */ ([0, 0, 0]),
    tracked: /** @type {undefined | import('three').Object3D} */ (undefined),
    offset: /** @type {undefined | import('three').Vector3Like} */ (undefined),
    open: false,
    /** @type {import('../components/Html3d').State} */
    html3d: /** @type {*} */ (null),

    pinned: tryLocalStorageGetParsed(`default-context-menu@${w.key}`)?.pinned ?? w.smallViewport,
    scaled: false,
    showKvs: true,
  
    dockPoint: { x: 0, y: 0 },
    /** @type {{ k: string; v: string; length: number; }[]} */
    kvs: [],
    /** @type {HTMLElement} */
    innerRoot: /** @type {*} */ (null),
    /** @type {NPC.ContextMenuLink[]} */
    links: [],
    match: /** @type {{ [matcherKey: string]: NPC.ContextMenuMatcher}} */ ({}),
    meta: /** @type {Geom.Meta} */ ({}),
    npcKey: /** @type {undefined | string} */ (undefined),
    /** @type {import('../components/PopUp').State} */
    popUp: /** @type {*} */ (null),
    selectNpcKeys: /** @type {string[]} */ ([]),

    /** `cm.dockPoint` when on pointer down */
    downDockPoint: /** @type {undefined | Geom.VectJson} */ (undefined),
    /** Was pointerdown over contextmenu and not yet up? */
    isDown: false,

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
      state.isDown = true;
      state.downDockPoint = state.docked ? {...state.dockPoint} : undefined;
    },
    onPointerUp(e) {
      const { downDockPoint, isDown } = state;
      state.downDockPoint = undefined;
      state.isDown = false;

      if (isDown === false) {
        return;
      } else if (state.docked === false) {
        state.onToggleLink(e);
      } else if (
        downDockPoint !== undefined &&
        tmpVect.copy(downDockPoint).distanceTo(state.dockPoint) < 4
      ) {// docked click without drag
        state.onToggleLink(e);
      } else {// dragged docked click
        state.popUp.preventToggle = true;
        setTimeout(() => state.popUp.preventToggle = false);
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
        return warn(`${'onClick'}: ignored el ${el.tagName} with class ${el.className}`);
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
      const { pinned, showKvs, docked } = this;
      tryLocalStorageSet(`default-context-menu@${w.key}`, JSON.stringify({
        pinned, showKvs, docked,
      }));
    },
    popUpRef(popUp) {
      return popUp !== null
        ? state.popUp = popUp // @ts-ignore
        : delete state.popUp;
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
        if (state.everDocked === false) {// initially dock at bottom left
          const elRect = state.innerRoot.getBoundingClientRect();
          const rootRect = w.view.rootEl.getBoundingClientRect();
          state.dockPoint = { x: 0, y: rootRect.height - elRect.height };
          state.everDocked = true;
        }
      }
    },
    togglePinned() {
      state.pinned = !state.pinned;
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
      {state.docked === true && (
        <Draggable
          ref={state.ref('draggable')}
          container={w.view.rootEl}
          initPos={state.dockPoint}
          observeSizes={[w.view.rootEl, state.innerRoot]}
        >
          <ContextMenuUi state={state} />
        </Draggable>
      )}
      
      {state.docked === false && <ContextMenuUi state={state} />}
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
    <div className={cx({ hidden: cm.npcKey === undefined }, "npc-key")}>
      @<span>{cm.npcKey}</span>
    </div>
  
    <div className="links">

      <button
        data-key="toggle-docked"
        onKeyDown={cm.onKeyDownButton}
      >
        {cm.docked ? 'embed' : 'dock'}
      </button>

      <PopUp
        ref={cm.popUpRef.bind(cm)}
        infoClassName={popUpInfoCss}
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
            <option value={npcKey}>{npcKey}</option>
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
      {cm.kvs.map(({ k, v }) => (
        <div key={k} className="kv">
          <span className="key">{k}</span>
          {v !== '' && <span className="value">{v}</span>}
        </div>
      ))}
    </div>}
  </div>;
}

const tmpVect = new Vect();

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
    /* user-select: auto; */

    .inner-root {
      width: 200px;
      background-color: #000;
    }
  }

  .npc-key {
    position: absolute;
    top: -24px;
    height: 24px;

    background-color: black;
    span {
      color: #99ff99;
      pointer-events: none;
    }
    padding: 2px 6px;
  }
  .npc-key.hidden {
    display: none;
  }

  &.docked {
    z-index: 7; // 🚧
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
  
  .links > * {
    flex: 1;
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
    padding: 4px;
  }

  .kv {
    display: flex;
    align-items: center;

    flex: 1;
    /* border: 1px solid #222; */
    /* font-family: 'Courier New', Courier, monospace; */

    .key {
      padding: 2px;
    }
    .value {
      padding: 0 4px;
      color: #cca;
      max-width: 128px;
    }
  }
`;

const popUpInfoCss = css`
  display: flex;
  justify-content: space-around;
  align-items: center;
  font-size: small;

  select {
    border: 1px solid #555;
  }
;`

/**
 * @typedef {{
 *   baseScale: undefined | number;
 *   docked: boolean;
 *   dockPoint: Geom.VectJson;
 *   downDockPoint: undefined | Geom.VectJson;
 *   draggable: null | import('../components/Draggable').State;
 *   epochMs: number;
 *   everDocked: boolean;
 *   html3d: import("../components/Html3d").State;
 *   innerRoot: HTMLElement;
 *   isDown: boolean;
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
 *   pinned: any;
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
 *   popUpRef(popUp: null | import("../components/PopUp").State): void;
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
