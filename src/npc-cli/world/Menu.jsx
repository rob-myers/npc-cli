import React from "react";
import { css, cx } from "@emotion/css";

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
    isOpen: false,
    justOpen: false,
    hide() {
      state.isOpen = false;
      update();
    },
    show(at) {
      const menuDim = state.menuEl.getBoundingClientRect();
      const canvasDim = w.ui.canvas.getBoundingClientRect();
      const x = geom.clamp(at.x, 0, canvasDim.width - menuDim.width);
      const y = geom.clamp(at.y, 0, canvasDim.height - menuDim.height);
      state.menuEl.style.transform = `translate(${x}px, ${y}px)`;
      state.isOpen = true;
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
      style={{ visibility: state.isOpen ? 'visible' : 'hidden' }}
    >
      <div>
        {meta3d && Object.entries(meta3d).map(([k, v]) =>
          <div key={k}>{v === true ? k : `${k}: ${v}`}</div>
        )}
      </div>
    </div>

    <div // Fade overlay
      className={cx(faderOverlayCss, w.disabled ? 'faded' : 'clear')}
      onPointerDown={() => props.setTabsEnabled(true)} // 🔔 shortcut
    />
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
 * @property {boolean} isOpen
 * @property {boolean} justOpen
 * @property {HTMLDivElement} menuEl
 * @property {() => void} hide
 * @property {(at: Geom.VectJson) => void} show
 */

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
    opacity: 0.6;
    transition: opacity 0.5s ease-in;
  }

  &:not(.faded) {
  }
`;
