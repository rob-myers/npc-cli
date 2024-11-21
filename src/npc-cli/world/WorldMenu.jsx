import React from "react";
import { css, cx } from "@emotion/css";

import { tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { geom } from '../service/geom';
import { ansi } from "../sh/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { faderOverlayCss, pausedControlsCss } from "./overlay-menu-css";
import { ContextMenu } from "./ContextMenu";
import { Logger } from "../terminal/Logger";
import TouchIndicator from "./TouchIndicator";

/**
 * @param {Pick<import('./World').Props, 'setTabsEnabled'>} props 
 */
export default function WorldMenu(props) {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({

    cm: /** @type {*} */ (null),
    debugWhilePaused: false,
    durationKeys: {},
    initHeight: tryLocalStorageGetParsed(`log-height-px@${w.key}`) ?? 200,
    logger: /** @type {*} */ (null),
    pinned: tryLocalStorageGetParsed(`pin-log@${w.key}`) ?? false,

    changeLoggerPin(e) {
      state.pinned = e.currentTarget.checked;
      tryLocalStorageSet(`pin-log@${w.key}`, `${state.pinned}`);
      update();
    },
    enableAll() {
      props.setTabsEnabled(true);
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

  return <>

    <div
      className={cx(
        faderOverlayCss,
        w.disabled && !state.debugWhilePaused ? 'faded' : 'clear',
      )}
      onPointerUp={() => props.setTabsEnabled(true)}
    />

    {w.disabled && (
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

    <ContextMenu ref={api => state.cm = state.cm ?? api} />

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

    <TouchIndicator/>

  </>;
}

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
 * @property {import('./ContextMenu').State} cm
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {import('../terminal/Logger').State} logger
 * @property {number} initHeight
 * @property {boolean} pinned
 * @property {() => void} enableAll
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {React.ChangeEventHandler<HTMLInputElement & { type: 'checkbox' }>} changeLoggerPin
 * @property {() => void} storeTextareaHeight
 * @property {() => void} toggleDebug
 */
