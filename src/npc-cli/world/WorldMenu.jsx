import React from "react";
import { css, cx } from "@emotion/css";
import { createPortal } from "react-dom";

import { tryLocalStorageGetParsed, tryLocalStorageSet, warn } from "../service/generic";
import { ansi } from "../sh/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { faderOverlayCss, pausedControlsCss } from "./overlay-menu-css";
import { Draggable } from "../components/Draggable";
import { PopUp, popUpButtonClassName, popUpContentClassName } from "../components/PopUp";
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
    draggable: /** @type {*} */ (null),
    dragClassName: w.smallViewport ? 'pop-up-content' : undefined,
    durationKeys: {},
    logger: /** @type {*} */ (null),
    loggerHeight: tryLocalStorageGetParsed(`log-height@${w.key}`) ?? defaultLoggerHeightPx / loggerHeightDelta,
    loggerWidth: tryLocalStorageGetParsed(`log-width@${w.key}`) ?? defaultLoggerWidthPx / loggerWidthDelta,
    showMeasures: tryLocalStorageGetParsed(`log-show-measures@${w.key}`) ?? false,

    changeLoggerLog(e) {
      state.showMeasures = e.currentTarget.checked;
      tryLocalStorageSet(`log-show-measures@${w.key}`, `${state.showMeasures}`);
      update();
    },
    enableAll() {
      props.setTabsEnabled(true);
    },
    measure(msg) {
      if (state.showMeasures === false) {
        return;
      } else if (msg in state.durationKeys) {
        const durationMs = (performance.now() - state.durationKeys[msg]).toFixed(1);
        state.logger?.xterm.writeln(`${msg} ${ansi.BrightYellow}${durationMs}${ansi.Reset}`);
        delete state.durationKeys[msg];
      } else {
        state.durationKeys[msg] = performance.now();
      }
    },
    onClickLoggerLink(e) {
      const [npcKey] = e.fullLine.slice('[ '.length).split(' ] ', 1);
      if (npcKey in w.n) {// prefix `[ {npcKey} ] ` 
        w.events.next({ key: 'click-npc-link', npcKey, ...e });
      }
    },
    onOverlayPointerUp() {
      props.setTabsEnabled(true);
    },
    onResizeLoggerHeight(e) {
      state.loggerHeight = Number(e.currentTarget.value); // e.g. 2, ..., 10
      state.logger.container.style.height = `${state.loggerHeight * loggerHeightDelta}px`;
      tryLocalStorageSet(`log-height@${w.key}`, `${state.loggerHeight}`);
      state.draggable.updatePos();
    },
    onResizeLoggerWidth(e) {
      state.loggerWidth = Number(e.currentTarget.value);
      state.logger.container.style.width = `${state.loggerWidth * loggerWidthDelta}px`;
      tryLocalStorageSet(`log-width@${w.key}`, `${state.loggerWidth}`);
      state.draggable.updatePos();
    },
    say(npcKey, ...parts) {
      const line = parts.join(' ');
      state.logger.xterm.writeln(
        `${ansi.BrightGreen}[ ${ansi.BrightYellow}${ansi.Bold}${npcKey}${ansi.BrightGreen}${ansi.BoldReset} ]${ansi.Reset} ${line}${ansi.Reset}`
      );
      state.logger.xterm.scrollToBottom();
    },
    toggleDebug() {
      // by hiding overlay we permit user to use camera while World paused
      state.debugWhilePaused = !state.debugWhilePaused;
      update();
    },
    toggleXRay() {
      w.wall.setOpacity(w.wall.opacity === 0.45 ? 1 : 0.45);
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
      <button
        onClick={state.toggleXRay}
        className={w.wall.opacity < 1 ? 'text-green' : undefined}
      >
        x-ray
      </button>
    </div>}

    {w.view.rootEl && createPortal(
      <Draggable
        className={loggerContainerCss}
        ref={state.ref('draggable')}
        container={w.view.rootEl}
        dragClassName={state.dragClassName}
        initPos={{ x: 0, y: 0 }}
      >
        <div>
          <PopUp
            label="⋯"
            className={loggerPopUpCss}
            width={300}
          >
            <div>
              <label>
                <input
                  type="range"
                  className="change-logger-width"
                  min={4}
                  max={w.smallViewport ? 7 : 10}
                  defaultValue={state.loggerWidth}
                  onChange={state.onResizeLoggerWidth}
                />
                w
              </label>

              <label>
                <input
                  type="range"
                  className="change-logger-height"
                  min={2}
                  max={10}
                  defaultValue={state.loggerHeight}
                  onChange={state.onResizeLoggerHeight}
                />
                h
              </label>
            </div>

            {/* {w.smallViewport === true && (
              <label>
                move
                <input
                  type="checkbox"
                  defaultChecked={state.canDragLogger}
                  onChange={state.changeLoggerMove}
                />
              </label>
            )} */}

            <label>
              log
              <input
                type="checkbox"
                defaultChecked={state.showMeasures}
                onChange={state.changeLoggerLog}
              />
            </label>

          </PopUp>

        </div>
        <Logger
          ref={state.ref('logger')}
          onClickLink={state.onClickLoggerLink}
          initDim={[state.loggerWidth * loggerWidthDelta, state.loggerHeight * loggerHeightDelta]}
        />
      </Draggable>,
      w.view.rootEl,
    )}

    <TouchIndicator/>

    <div className={cx(cssTtyDisconnectedMessage, {
      hidden: w.disconnected === false
    })}>
      <h3>[disconnected]</h3>
      click or show a tty tab
    </div>

  </>;
}

const defaultLoggerHeightPx = 100;
const defaultLoggerWidthPx = 800;
/** Must be a factor of default height */
const loggerHeightDelta = 20;
/** Must be a factor of default width */
const loggerWidthDelta = 100;

const loggerContainerCss = css`
  position: absolute;
  left: 0;
  top: 0;
  max-width: 100%;
  
  > div:nth-child(1) {
    height: 24px;
    display: flex;
    gap: 8px;
    font-size: 1rem;
  }
  > div:nth-child(2) {
    /* height: ${defaultLoggerHeightPx}px; */
    /* width: ${defaultLoggerWidthPx}px; */
    width: 0px;
    max-width: 100%;
    padding: 8px 0 0 12px;
  }
  
  display: flex;
  flex-direction: column;
  align-items: start;
  pointer-events: none;
`;

const loggerPopUpCss = css`
  pointer-events: all;
  transform: scale(.85);
  z-index: 5;

  .${popUpButtonClassName} {
    color: #8888ff;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-width: 1px 0 0 1px;
    background: black;
    padding: 2px 12px;
    text-decoration: underline;
  }

  .${popUpContentClassName} {

    display: flex;
    justify-content: space-evenly;
    align-items: center;
    gap: 8px;

    font-size: smaller;
    color: white;
    
    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Courier New', Courier, monospace;
    }

    /** https://www.smashingmagazine.com/2021/12/create-custom-range-input-consistent-browsers/ */
    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    input[type="range"]::-webkit-slider-runnable-track {
      background: #053a5f;
      height: 0.5rem;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; /* Override default look */
      appearance: none;
      background-color: #5cd5eb;
      height: 8px;
      width: 8px;
    }
    input[type="range"]::-moz-range-track {
      background: #053a5f;
      height: 0.5rem;
    }
    input[type="range"]::-moz-range-thumb {
      border: none; /*Removes extra border that FF applies*/
      border-radius: 0; /*Removes default border-radius that FF applies*/
      background-color: #5cd5eb;
      height: 8px;
      width: 8px;
    }

    .change-logger-height, .change-logger-width {
      width: 60px;
    }
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
  opacity: 100;
  &.hidden {
    opacity: 0;
    display: initial; // override commons.css
  }
`;

/**
 * @typedef State
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {import('../components/Draggable').State} draggable Draggable containing Logger
 * @property {string} [dragClassName] We can restrict Logger dragging to this className
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {import('../terminal/Logger').State} logger
 * @property {number} loggerHeight
 * @property {number} loggerWidth
 * @property {boolean} showMeasures
 *
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} changeLoggerLog
 * @property {() => void} enableAll
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {(e: NPC.ClickLinkEvent) => void} onClickLoggerLink
 * @property {() => void} onOverlayPointerUp
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onResizeLoggerHeight
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onResizeLoggerWidth
 * @property {(npcKey: string, line: string) => void} say
 * @property {() => void} toggleDebug
 * @property {() => void} toggleXRay
 * @property {() => void} update
 */
