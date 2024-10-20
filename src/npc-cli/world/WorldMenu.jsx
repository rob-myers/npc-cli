import React from "react";
import { css, cx } from "@emotion/css";

import { tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { geom } from '../service/geom';
import { ansi } from "../sh/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { faderOverlayCss, pausedControlsCss } from "./overlay-menu-css";
import { Logger } from "../terminal/Logger";

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
    
    logger: /** @type {*} */ (null),
    initHeight: tryLocalStorageGetParsed(`log-height-px@${w.key}`) ?? 200,
    pinned: tryLocalStorageGetParsed(`pin-log@${w.key}`) ?? false,

    changeLoggerPin(e) {
      state.pinned = e.currentTarget.checked;
      tryLocalStorageSet(`pin-log@${w.key}`, `${state.pinned}`);
      update();
    },
    enableAll() {
      props.setTabsEnabled(true);
    },
    hide() {
      state.ctOpen = false;
      update();
    },
    measure(msg) {
      if (msg in state.durationKeys) {
        const durationMs = (performance.now() - state.durationKeys[msg]).toFixed(1);
        state.logger.xterm.writeln(`${msg} ${ansi.BrightYellow}${durationMs}${ansi.Reset}`);
        delete state.durationKeys[msg];
      } else {
        state.durationKeys[msg] = performance.now();
      }
    },
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
        Math.max(100, state.logger.container.getBoundingClientRect().height)
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
        {/* 🚧 */}
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

    <div
      className={loggerCss}
      {...!(state.debugWhilePaused || state.pinned) && {
        style: { display: 'none' }
      }}
    >
      <Logger
        ref={api => state.logger = state.logger ?? api}
        className="world-logger"
      />

      <label>
        <input
          type="checkbox"
          defaultChecked={state.pinned}
          onChange={state.changeLoggerPin}
        />
        pin
      </label>
    </div>

  </>;
}

const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;

  max-width: 256px;

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

const loggerCss = css`
  position: absolute;
  z-index: 6;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: end;

  color: white;
  font-size: 12px;
  font-family: 'Courier New', Courier, monospace;
  padding: 8px;

  .world-logger {
    /* 🚧 */
    width: 230px;
    height: 200px;
    textarea {
      visibility: hidden; // Hide cursor
    }
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

/**
 * @typedef State
 * @property {HTMLDivElement} ctMenuEl
 * @property {boolean} ctOpen Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {import('../terminal/Logger').State} logger
 * @property {number} initHeight
 * @property {boolean} pinned
 * @property {() => void} enableAll
 * @property {() => void} hide
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {React.ChangeEventHandler<HTMLInputElement & { type: 'checkbox' }>} changeLoggerPin
 * @property {() => void} storeTextareaHeight
 * @property {(at: Geom.VectJson) => void} show
 * @property {() => void} toggleDebug
 */
