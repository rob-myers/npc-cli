import React from "react";
import { css, cx } from "@emotion/css";

import { tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { ansi } from "../sh/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { faderOverlayCss, pausedControlsCss } from "./overlay-menu-css";
import { Logger } from "../terminal/Logger";
import TouchIndicator from "./TouchIndicator";

/**
 * @param {Pick<import('./World').Props, 'setTabsEnabled'>} props 
 */
export default function WorldMenu(props) {

  const w = React.useContext(WorldContext);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({

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
    onOverlayPointerUp() {
      props.setTabsEnabled(true);
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
    update,
  }));

  w.menu = state;

  return <>

    <div
      className={cx(faderOverlayCss, {
        faded: w.disabled && !state.debugWhilePaused,
      })}
      onPointerUp={state.onOverlayPointerUp}
    />

    {w.disabled && <div className={pausedControlsCss}>
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
    </div>}

    <div className={cx(loggerCss, {
        shown: state.pinned || (w.disabled && state.debugWhilePaused),
      })}
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

    <div className={cx(cssTtyDisconnectedMessage, {
      shown: w.disconnected === true
    })}>
      <h3>[disconnected]</h3>
      click or show a TTY tab
    </div>

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
  &:not(.shown) {
    display: none;
  }
`;

const cssTtyDisconnectedMessage = css`
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 5;
  
  pointer-events: none;
  padding: 16px;
  margin: 0 16px 16px 0;
  @media (max-width: 700px) {
    margin: 0;
  }

  background-color: rgba(0, 0, 0, 0.5);
  font-size: 0.9rem;
  
  color: #aaa;

  h3 {
    font-family: 'Courier New', Courier, monospace;
    color: #8f8;
  }

  transition: opacity 600ms;
  opacity: 0;
  &.shown {
    opacity: 100;
  }
`;


/**
 * @typedef State
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {import('../terminal/Logger').State} logger
 * @property {number} initHeight
 * @property {boolean} pinned
 * @property {() => void} enableAll
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {React.ChangeEventHandler<HTMLInputElement & { type: 'checkbox' }>} changeLoggerPin
 * @property {() => void} onOverlayPointerUp
 * @property {() => void} storeTextareaHeight
 * @property {() => void} toggleDebug
 * @property {() => void} update
 */
