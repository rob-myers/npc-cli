import React from "react";
import { css, cx } from "@emotion/css";
import debounce from "debounce";

import { tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { isTouchDevice } from "../service/dom";
import { geom } from '../service/geom';
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { faderOverlayCss, pausedControlsCss } from "./overlay-menu-css";


/**
 * @param {Pick<import('./World').Props, 'setTabsEnabled'>} props 
 */
export default function WorldMenu(props) {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    ctMenuEl: /** @type {*} */ (null),
    ctOpen: false,
    justOpen: false,
    debugWhilePaused: false,
    durationKeys: {},
    textarea: {
      el: /** @type {*} */ (null),
      initHeight: tryLocalStorageGetParsed(`log-height-px@${w.key}`) ?? 200,
      pinned: tryLocalStorageGetParsed(`pin-log@${w.key}`) ?? false,
      text: '',
    },

    changeTextareaPin(e) {
      state.textarea.pinned = e.currentTarget.checked;
      tryLocalStorageSet(`pin-log@${w.key}`, `${state.textarea.pinned}`);
      update();
    },
    enableAll() {
      props.setTabsEnabled(true);
    },
    hide() {
      state.ctOpen = false;
      update();
    },
    log(msg, type) {
      if (typeof type === undefined) {
        state.textarea.text += `${msg}\n`;
      } else if (type === '⏱') {
        if (msg in state.durationKeys) {
          const durationMs = (performance.now() - state.durationKeys[msg]).toFixed(2);
          state.textarea.text += `${msg} (${durationMs})\n`;
          delete state.durationKeys[msg];
        } else {
          state.durationKeys[msg] = performance.now();
        }
      }
      state.logsToBottom();
      update();
    },
    logsToBottom: debounce(() => {
      state.textarea.el?.scrollTo({ top: Number.MAX_SAFE_INTEGER })
    }, 300, { immediate: true }),
    show(at) {
      const menuDim = state.ctMenuEl.getBoundingClientRect();
      const canvasDim = w.ui.canvas.getBoundingClientRect();
      const x = geom.clamp(at.x, 0, canvasDim.width - menuDim.width);
      const y = geom.clamp(at.y, 0, canvasDim.height - menuDim.height);
      state.ctMenuEl.style.transform = `translate(${x}px, ${y}px)`;
      state.ctOpen = true;
      update();
    },
    storeTextareaHeight() {
      tryLocalStorageSet(`log-height-px@${w.key}`, `${
        Math.max(100, state.textarea.el.getBoundingClientRect().height)
      }`);
    },
    toggleDebug() {
      // by hiding overlay we permit user to use camera while World paused
      state.debugWhilePaused = !state.debugWhilePaused;
      update();
    },
  }));

  w.menu = state;

  const update = useUpdate();

  React.useLayoutEffect(() => () => state.storeTextareaHeight(), []);

  const meta3d = w.ui.lastDown?.threeD?.meta;

  return <>

    <div // Context Menu
      ref={(x) => x && (state.ctMenuEl = x)}
      className={contextMenuCss}
      onContextMenu={(e) => e.preventDefault()}
      // 🔔 use 'visibility' to compute menuDim.height
      style={{ visibility: state.ctOpen ? 'visible' : 'hidden' }}
    >
      <div>
        {meta3d && Object.entries(meta3d).map(([k, v]) =>
          <div key={k}>{v === true ? k : `${k}: ${v}`}</div>
        )}
      </div>
    </div>

    <div // Fade Overlay
      className={cx(faderOverlayCss, w.disabled && !state.debugWhilePaused ? 'faded' : 'clear')}
      onPointerUp={() => props.setTabsEnabled(true)}
    />

    {w.disabled && (// Overlay Buttons
      <div className={pausedControlsCss}>
        <button
          onClick={state.enableAll}
          className="text-white"
        >
          enable
        </button>
        <button
          onClick={state.toggleDebug}
          className={state.debugWhilePaused ? 'text-green' : undefined}
        >
          debug
        </button>
      </div>
    )}

    {(state.debugWhilePaused || state.textarea.pinned) && (
      <div className={textareaCss}>
        <textarea
          ref={(x) => x && (state.textarea.el = x)}
          readOnly
          value={state.textarea.text}
          style={{ height: state.textarea.initHeight }}
        />
        <label>
          <input
            type="checkbox"
            defaultChecked={state.textarea.pinned}
            onChange={state.changeTextareaPin}
          />
          pin
        </label>
      </div>
    )}


  </>;
}

const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  /* height: 100px; */
  max-width: 256px;
  /* user-select: none; */

  opacity: 0.8;
  font-size: 0.9rem;
  color: white;
  
  > div {
    border: 2px solid #aaa;
    border-radius: 5px;
    padding: 8px;
    background-color: #222;
  }

  select {
    color: black;
    max-width: 100px;
    margin: 8px 0;
  }
`;

const textareaCss = css`
  position: absolute;
  z-index: 7;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: end;

  color: white;
  font-size: 12px;
  font-family: 'Courier New', Courier, monospace;

  textarea {
    background: rgba(0, 50, 0, 0.35);
    padding: 0 8px;
    width: 220px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`

/**
 * @typedef State
 * @property {HTMLDivElement} ctMenuEl
 * @property {boolean} ctOpen Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {{ el: HTMLTextAreaElement; pinned: boolean; initHeight: number; text: string; }} textarea
 *
 * @property {() => void} enableAll
 * @property {() => void} hide
 * @property {(msg: string, type?: '⏱') => void} log
 * - Can log durations by sending same `msg` twice.
 * - Can also log plain strings.
 * @property {() => void} logsToBottom
 * @property {React.ChangeEventHandler<HTMLInputElement & { type: 'checkbox' }>} changeTextareaPin
 * @property {() => void} storeTextareaHeight
 * @property {(at: Geom.VectJson) => void} show
 * @property {() => void} toggleDebug
 */
