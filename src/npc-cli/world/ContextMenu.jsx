import React from "react";
import * as THREE from "three";
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
    downAt: null,
    draggable: /** @type {*} */ (null),
    html3d: /** @type {*} */ (null),
    offset: undefined,
    optsPopUp: /** @type {*} */ (null),
    position: new THREE.Vector3(),
    tracked: undefined,
    
    docked: false,
    open: false,
    pinned: tryLocalStorageGetParsed(`context-menu:pinned@${w.key}`) ?? w.smallViewport,
    scaled: false,
    showKvs: true,
  
    kvs: [],
    links: [],
    match: {},
    meta: {},
    npcKey: undefined,
    selectNpcKeys: [],

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
      state.refreshOptsPopUp();
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

      state.persist();
      update();
    },
    onToggleOptsPopup(willOpen) {
      if (willOpen) {
        state.refreshOptsPopUp();
      }
    },
    persist() {
      tryLocalStorageSet(`context-menu:pinned@${w.key}`, JSON.stringify(state.pinned));
    },
    refreshOptsPopUp: debounce(() => {
      state.selectNpcKeys = Object.keys(w.n);
      update();
    }, 30, { immediate: true }),
    /**
     * Context is world position and meta concerning said position
     */
    setContext({ position, meta }) {
      state.meta = meta;
      state.position = position.clone();
      state.computeKvsFromMeta(meta);
      state.computeLinks();
    },
    setNpc(npcKey) {
      state.npcKey = npcKey;
      update();
    },
    setTracked(input) {
      state.tracked = input;
    },
    show() {
      state.open = true;
      update();
    },
    toggleDocked() {
      state.docked = !state.docked;
      
      if (state.docked === true) {// About to dock
        state.optsPopUp.close();
        state.html3d.innerDiv.style.transform = 'scale(1)';
        // 🔔 crucial to avoid flicker on mobile
        state.draggable.el.style.visibility = 'hidden';
      }
    },
    togglePinned() {
      state.pinned = !state.pinned;
      if (state.pinned === false) {
        state.open = false; // auto-close on un-pin
      }
    },
    toggleScaled() {
      state.scaled = !state.scaled;
      const position = state.tracked?.position ?? state.position;
      state.baseScale = state.scaled === true ? 1 / objectScale(position, w.r3f.camera) : undefined;
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
      tracked={state.tracked ?? null}
      position={state.position}
    >
      <Draggable
        ref={state.ref('draggable')}
        container={w.view.rootEl}
        disabled={state.docked === false}
        initPos={{ x: 0, y: 2000 }}
        localStorageKey={`contextmenu:dragPos@${w.key}`}
      >
        <div
          className="inner-root"
          onPointerUp={state.onPointerUp}
          onPointerDown={state.onPointerDown}
        >
          <ContextMenuLinks state={state} />

          {state.showKvs === true && <ContextMenuMeta state={state} />}
        </div>
      </Draggable>
    </Html3d>
  );
}

/** @param {{ state: import("../hooks/use-state-ref").UseStateRef<State> }} Props */
function ContextMenuLinks({ state }) {
  return (
    <div className="links">

      <button
        data-key="toggle-docked"
        onKeyDown={state.onKeyDownButton}
      >
        {state.docked ? 'embed' : 'dock'}
      </button>

      <PopUp
        ref={state.ref('optsPopUp')}
        className={optsPopUpCss}
        label="opts"
        onChange={state.onToggleOptsPopup.bind(state)}
        width={200}
      >
        <select
          className="select-npc"
          onChange={state.onSelectNpc.bind(state)}
          value={state.npcKey ?? ""}
        >
          <option key="none" value="">
            no npc
          </option>
          {state.selectNpcKeys.map(npcKey => 
            <option key={npcKey} value={npcKey}>{npcKey}</option>
          )}
        </select>

        <button
          key="toggle-scaled"
          data-key="toggle-scaled"
          className={!state.scaled ? 'off' : undefined}
        >
          scale
        </button>
      </PopUp>

      <button
        key="toggle-kvs"
        data-key="toggle-kvs"
        className={!state.showKvs ? 'off' : undefined}
        onKeyDown={state.onKeyDownButton}
      >
        meta
      </button>

      <button
        key="toggle-pinned"
        data-key="toggle-pinned"
        className={!state.pinned ? 'off' : undefined}
        onKeyDown={state.onKeyDownButton}
      >
        pin
      </button>

      {state.links.map(({ key, label, test }) =>
        <button
          key={key}
          data-key={key}
          className={test !== undefined && !(/** @type {*} */ (state)[test]) ? 'off' : undefined}
        >
          {label}
        </button>
      )}
    </div>
  );
}

/** @param {{ state: import("../hooks/use-state-ref").UseStateRef<State> }} Props */
function ContextMenuMeta({ state }) {
  return (
    <div className="kvs">
      {state.kvs.map((x, i) => [
        <span key={i} className="key">{x.k}</span>,
        x.v !== '' ? <span key={i + 'v'} className="value">{x.v}</span> : null,
      ])}
    </div>
  );
}

const contextMenuWidthPx = 200;

export const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  background: transparent !important;
  pointer-events: none;

  > div {
    transform-origin: 0 0;
    pointer-events: all;

    .inner-root {
      width: ${contextMenuWidthPx}px;
      background-color: rgba(0, 0, 0, 0.8);
      border-radius: 0 8px 8px 8px;
      border: 1px solid #333;
      padding: 4px;
      font-size: small;
    }
  }

  z-index: 4; // in front of Logger and its PopUp

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

const optsPopUpCss = css`
  z-index: 4;

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
 * @typedef State
 * @property {undefined | number} baseScale
 * @property {boolean} docked
 * @property {import('../components/Draggable').State} draggable
 * @property {import("../components/Html3d").State} html3d
 * @property {null | Geom.VectJson} downAt
 * @property {{ k: string; v: string; length: number }[]} kvs
 * @property {NPC.ContextMenuLink[]} links
 * @property {{ [matcherKey: string]: NPC.ContextMenuMatcher }} match
 * @property {Geom.Meta} meta
 * @property {undefined | string} npcKey
 * @property {undefined | import("three").Vector3Like} offset
 * @property {boolean} open
 * @property {import("../components/PopUp").State} optsPopUp
 * @property {import('three').Vector3} position
 * @property {undefined | import("three").Object3D} tracked
 * @property {boolean} pinned
 * @property {boolean} scaled
 * @property {string[]} selectNpcKeys
 * @property {boolean} showKvs
 * @property {(meta: Geom.Meta) => void} computeKvsFromMeta
 * @property {() => void} computeLinks
 * @property {(force?: boolean | undefined) => void} hide
 * @property {(e: React.KeyboardEvent<HTMLButtonElement>) => void} onKeyDownButton
 * @property {(e: React.PointerEvent) => void} onPointerDown
 * @property {(e: React.PointerEvent) => void} onPointerUp
 * @property {(e: React.MouseEvent | React.KeyboardEvent) => void} onToggleLink
 * @property {(e: React.ChangeEvent<HTMLSelectElement>) => void} onSelectNpc
 * @property {(willOpen: boolean) => void} onToggleOptsPopup
 * @property {() => void} persist
 * @property {() => void} refreshOptsPopUp
 * @property {({ position, meta }: NPC.ContextMenuContextDef) => void} setContext
 * @property {(npcKey?: string | undefined) => void} setNpc
 * @property {(input?: import('three').Object3D) => void} setTracked
 * @property {() => void} show
 * @property {() => void} toggleDocked
 * @property {() => void} togglePinned
 * @property {() => void} toggleScaled Ensure smooth transition when start scaling
 * @property {() => void} toggleKvs
 **/
