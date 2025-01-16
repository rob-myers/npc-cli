import React from "react";
import { css, cx } from "@emotion/css";
import { createPortal } from "react-dom";

import { tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { ansi } from "../sh/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { faderOverlayCss, pausedControlsCss } from "./overlay-menu-css";
import { Draggable } from "../components/Draggable";
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
    onOverlayPointerUp() {
      props.setTabsEnabled(true);
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

    {/* 🚧 move measures option into paused menu */}
    {/* <div className="controls">
      <label>
        <input
          type="checkbox"
          defaultChecked={state.showMeasures}
          onChange={state.changeShowMeasures}
        />
        measure
      </label>
    </div> */}
    
    {w.view.rootEl && createPortal(
      <Draggable
        className={loggerCss}
        container={w.view.rootEl}
        initPos={{ x: 0, y: 0 }}
        observeSizes={[w.view.rootEl]}
      >
        <div className="links">
          <button>
            move
          </button>
          <button>
            resize
          </button>
        </div>
        <Logger
          ref={state.ref('logger')}
          className="world-logger"
          onClickLink={(e) => {
            const [npcKey] = e.fullLine.slice('[ '.length).split(' ] ', 1);
            if (npcKey in w.n) {// prefix `[ {npcKey} ] ` 
              w.events.next({ key: 'click-npc-link', npcKey, ...e });
            }
          }}
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

const loggerCss = css`

  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  max-width: 800px;
  height: 80px;

  display: flex;
  flex-direction: column;
  
  color: white;
  font-size: 12px;
  padding: 0px;
  
  .links {
    display: flex;
    justify-content: end;
    gap: 4px;

    button {
      text-decoration: underline;
      color: #aaf;
    }
  }

  .world-logger {
    width: 100%;
    height: 100%;
    // 🔔 cover bottom scroll spacing
    background: rgba(0, 0, 0, 1);
    border: 0px solid black;
    border-width: 8px 0 4px 16px;
    
    canvas {
      // 🔔 override textual selection cursor
      cursor: auto !important;
    }
    textarea {
      // 🔔 Hide xterm cursor
      visibility: hidden;
    }
    .terminal.xterm {
      /* height: 100%; */
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
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {import('../terminal/Logger').State} logger
 * @property {number} initHeight
 * @property {boolean} showMeasures
 *
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} changeShowMeasures
 * @property {() => void} enableAll
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {() => void} onOverlayPointerUp
 * @property {(npcKey: string, line: string) => void} say
 * @property {() => void} toggleDebug
 * @property {() => void} toggleXRay
 * @property {() => void} update
 */
