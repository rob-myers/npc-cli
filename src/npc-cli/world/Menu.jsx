import React from "react";
import { css, cx } from "@emotion/css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera } from "@fortawesome/free-solid-svg-icons";

import { isTouchDevice } from "../service/dom";
import { geom } from '../service/geom';
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { WorldContext } from "./world-context";


/**
 * @param {Pick<import('./World').Props, 'setTabsEnabled'>} props 
 */
export default function Menu(props) {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    menuEl: /** @type {*} */ (null),
    ctOpen: false,
    justOpen: false,
    pausedCamera: false,

    hide() {
      state.ctOpen = false;
      update();
    },
    show(at) {
      const menuDim = state.menuEl.getBoundingClientRect();
      const canvasDim = w.ui.canvas.getBoundingClientRect();
      const x = geom.clamp(at.x, 0, canvasDim.width - menuDim.width);
      const y = geom.clamp(at.y, 0, canvasDim.height - menuDim.height);
      state.menuEl.style.transform = `translate(${x}px, ${y}px)`;
      state.ctOpen = true;
      update();
    },
    togglePausedCamera() {
      state.pausedCamera = !state.pausedCamera;
      // 🚧
      update();
    },
  }));

  w.menu = state;

  const update = useUpdate();

  const meta3d = w.ui.lastDown?.threeD?.meta;

  return <>

    <div // ContextMenu
      ref={(x) => x && (state.menuEl = x)}
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

    <div // Fade overlay
      className={cx(faderOverlayCss, w.disabled ? 'faded' : 'clear')}
      {...{// 🔔 shortcut to enable all tabs
        [isTouchDevice() ? 'onPointerDown' : 'onPointerUp']: () => props.setTabsEnabled(true)
      }}
    />

    <div className={pausedControlsCss}>
      <button
        className={cx('camera', { disabled: !state.pausedCamera })}
        onClick={state.togglePausedCamera}
      >
        <FontAwesomeIcon icon={faCamera} size="1x" />
      </button>
    </div>
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

const faderOverlayCss = css`
  position: absolute;
  z-index: 4;

  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  
  background: rgba(1, 1, 1, 1);
  opacity: 1;
  transition: opacity 1s ease-in;
  &.clear {
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s ease-in;
  }
  &.faded {
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.5s ease-in;
  }

  &:not(.faded) {
  }
`;

const pausedControlsCss = css`
  position: absolute;
  right: 0;
  top: 64px;
  z-index: 4;

  .camera {
    color: white;
    padding: 8px 12px 8px 12px;
    background-color: #222;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    border-width: 1px 0 1px 1px;
    border-color: #444;
    font-size: 0.8rem;

    svg {
      filter: drop-shadow(2px 2px #900);
    }

    &:hover {
      transform: scale(1.1);
    }
  }

  .disabled {
    filter: brightness(0.5);
  }
`;

/**
 * @typedef State
 * @property {boolean} ctOpen Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} pausedCamera Is the camera usable whilst paused?
 * @property {HTMLDivElement} menuEl
 *
 * @property {() => void} hide
 * @property {(at: Geom.VectJson) => void} show
 * @property {() => void} togglePausedCamera
 */
