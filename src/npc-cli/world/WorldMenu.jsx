import React from "react";
import { css, cx } from "@emotion/css";

import { zIndex } from "../service/const";
import { tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { getRelativePointer, isSmallViewport } from "../service/dom";
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
    touchCircle: /** @type {*} */ (null),
    touchRadiusPx: isSmallViewport() ? 70 : 35,
    touchErrorPx: isSmallViewport() ? 10 : 5,
    
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
      const canvasDim = w.view.canvas.getBoundingClientRect();
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
  const lastMeta = w.view.lastDown?.meta;
  const update = useUpdate();

  React.useEffect(() => {

    /** @param {PointerEvent} e */
    function onPointerDown (e) {
      state.touchCircle.style.left = `${(e.clientX - state.touchRadiusPx)}px`;
      state.touchCircle.style.top = `${(e.clientY - state.touchRadiusPx)}px`;
      state.touchCircle.classList.add('active');
    }
    /** @param {PointerEvent} e */
    function onPointerUp (e) {
      state.touchCircle.classList.remove('active');
    }
    /** @param {PointerEvent} e */
    function onPointerMove(e) {
      if (w.view.down === undefined) {
        return;
      }
      if (w.view.down.screenPoint.distanceTo(getRelativePointer(e)) > state.touchErrorPx) {
        state.touchCircle.classList.remove('active');
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointermove', onPointerMove);
    
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointermove', onPointerMove);
    };

  }, []);

  return <>

    <div
      className={contextMenuCss}
      ref={(x) => void (x && (state.ctMenuEl = x))}
      // 🔔 'visibility' permits computing menuDim.height
      style={{ visibility: state.ctOpen ? 'visible' : 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="key-values">
        {lastMeta !== undefined && Object.entries(lastMeta).map(([k, v]) =>
          <div key={k}>
            <span className="meta-key">{k}</span>
            {v !== true && <>
              {': '}
              <span className="meta-value">{JSON.stringify(v)}</span>
            </>}
          </div>
        )}
      </div>
    </div>

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

    <div
      className={touchIndicatorCss}
      ref={x => {
        if (x) {
          state.touchCircle = x;
          state.touchCircle.style.setProperty('--touch-circle-radius', `${state.touchRadiusPx}px`);
        }
      }}
    />

  </>;
}

const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  max-width: 256px;
  
  opacity: 0.8;
  font-size: 0.8rem;
  color: white;
  
  div.key-values {
    display: flex;
    flex-direction: column;
    gap: 2px;
    
    background-color: #222;
    border: 1px solid #aaa;
    padding: 12px;
  }

  div.key-values .meta-key {
    color: #ff9;
  }
  div.key-values .meta-value {
    font-family: 'Courier New', Courier, monospace;
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

const touchIndicatorCss = css`
  position: fixed;
  z-index: ${zIndex.ttyTouchCircle};

  --touch-circle-radius: 0px;

  width: calc(2 * var(--touch-circle-radius));
  height: calc(2 * var(--touch-circle-radius));
  background: #fff;
  border-radius:50%;
  pointer-events:none;

  opacity: 0;
  transform: scale(0);
  transition: opacity 2s, transform ease-out 2s;
  
  &.active {
    transform: scale(1);
    opacity: 0.2;
    transition: opacity 0.3s, transform 0.3s;
  }
`;

/**
 * @typedef State
 * @property {HTMLDivElement} ctMenuEl
 * @property {boolean} ctOpen Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {HTMLDivElement} touchCircle
 * @property {number} touchRadiusPx
 * @property {number} touchErrorPx
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
