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

    canDragLogger: w.smallViewport === false,
    debugWhilePaused: false,
    durationKeys: {},
    initHeight: tryLocalStorageGetParsed(`log-height-px@${w.key}`) ?? 200,
    logger: /** @type {*} */ (null),
    showMeasures: tryLocalStorageGetParsed(`log-show-measures@${w.key}`) ?? false,

    changeShowMeasures(e) {
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
      console.log(Number(e.currentTarget.value));
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
        container={w.view.rootEl}
        initPos={{ x: 0, y: 0 }}
        enabled={state.canDragLogger}
      >
        <PopUp
          label="⋯"
          className={loggerPopUpCss}
        >
          <label>
            <input
              type="checkbox"
              defaultChecked={state.showMeasures}
              onChange={state.changeShowMeasures}
            />
            debug
          </label>

          <label>
            <input
              type="range"
              className="vertical-size"
              min={0}
              max={20}
              onChange={state.onResizeLoggerHeight}
            />
            h
          </label>
        </PopUp>
        <Logger
          ref={state.ref('logger')}
          className="logger"
          onClickLink={state.onClickLoggerLink}
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

const loggerPopUpCss = css`
  pointer-events: all;

  .${popUpButtonClassName} {
    color: #8888ff;
    padding: 2px 12px;
    text-decoration: underline;
  }

  .${popUpContentClassName} {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;

    font-size: smaller;
    
    label {
      display: flex;
      gap: 4px;
    }

    .vertical-size {
      width: 60px;
    }
  }
`;

const loggerContainerCss = css`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  
  /* 🚧 */
  max-width: 800px;
  height: 120px;

  display: flex;
  flex-direction: column;
  align-items: start;
  pointer-events: none;
  
  color: white;
  font-size: 12px;
  padding: 0px;
  
  .logger {
    width: 100%;
    height: calc(100% - 20px);
    pointer-events: all;
    
    border: 0px solid black;
    border-width: 8px 0 0 16px;
    // 🔔 cover bottom scroll spacing
    background: rgba(0, 0, 0, 1);
    
    // 🔔 override textual selection cursor
    canvas { cursor: auto !important; }
    // 🔔 Hide xterm cursor
    textarea { visibility: hidden; }
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
 * @property {boolean} canDragLogger
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {import('../terminal/Logger').State} logger
 * @property {number} initHeight
 * @property {boolean} showMeasures
 *
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} changeShowMeasures
 * @property {() => void} enableAll
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {(e: NPC.ClickLinkEvent) => void} onClickLoggerLink
 * @property {() => void} onOverlayPointerUp
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onResizeLoggerHeight
 * @property {(npcKey: string, line: string) => void} say
 * @property {() => void} toggleDebug
 * @property {() => void} toggleXRay
 * @property {() => void} update
 */
