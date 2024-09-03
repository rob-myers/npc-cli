import React from "react";
import { css, cx } from "@emotion/css";

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

    clickEnableAll() {
      props.setTabsEnabled(true);
    },
    hide() {
      state.ctOpen = false;
      update();
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
          onClick={state.clickEnableAll}
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

/**
 * @typedef State
 * @property {boolean} ctOpen Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} debugWhilePaused Is the camera usable whilst paused?
 * @property {HTMLDivElement} ctMenuEl
 *
 * @property {() => void} clickEnableAll
 * @property {() => void} hide
 * @property {(at: Geom.VectJson) => void} show
 * @property {() => void} toggleDebug
 */
