import React from "react";
import { css } from "@emotion/css";
import { geom } from "../service/geom";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { WorldContext } from "./world-context";

/**
 * @type {React.ForwardRefExoticComponent<Props & React.RefAttributes<State>>}
 */
export const ContextMenu = React.forwardRef(function ContextMenu(props, ref) {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    justOpen: false,
    open: false,
    rootEl: /** @type {*} */ (null),

    hide() {
      state.open = false;
      update();
    },
    onContextMenu(e) {
      // e.preventDefault();
    },
    rootRef(el) {
      if (el) {
        state.rootEl = el;
      }
    },
    show(at) {
      const menuDim = state.rootEl.getBoundingClientRect();
      const canvasDim = w.view.canvas.getBoundingClientRect();
      const x = geom.clamp(at.x, 0, canvasDim.width - menuDim.width);
      const y = geom.clamp(at.y, 0, canvasDim.height - menuDim.height);
      state.rootEl.style.transform = `translate(${x}px, ${y}px)`;
      state.open = true;
      update();
    },
  }));

  React.useMemo(() => void /** @type {React.RefCallback<State>} */ (ref)?.(state), [ref]);
  
  const update = useUpdate();

  w.cm = state;
  const lastMeta = w.view.lastDown?.meta;

  return (
    <div
      className={contextMenuCss}
      ref={state.rootRef}
      // 🔔 'visibility' permits computing menuDim.height
      style={{ visibility: state.open ? 'visible' : 'hidden' }}
      onContextMenu={state.onContextMenu}
    >
      <div className="buttons">
        <button>open</button>
      </div>
      <div className="key-values">
        {lastMeta !== undefined && Object.entries(lastMeta).map(([k, v]) =>
          <div key={k} className="key-value">
            <div className="meta-key">
              {k}
            </div>
            {v !== true && <div className="meta-value">{typeof v === 'string' ? v : JSON.stringify(v)}</div>}
          </div>
        )}
      </div>
    </div>
  );

});

const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  max-width: 256px;
  
  display: flex;
  flex-direction: column;
  gap: 0px;

  pointer-events: none;
  
  opacity: 0.8;
  font-size: 0.8rem;
  color: white;

  .buttons {
    padding-bottom: 16px;
  }

  button {
    border: 1px solid #aaa;
    color: black;
    background-color: white;
    padding: 0 4px;
    pointer-events: all;
  }

  div.key-values {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    
    /* padding: 8px; */
    /* border: 1px solid #999; */
    
    /* max-height: 100px; // 🚧 */

    overflow: hidden;
    background-color: inherit;
    filter: contrast(2);
  }
  
  div.key-value {
    /* padding-right: 4px; */
    border: 1px solid white;
    display: flex;
    align-items: end;

    pointer-events: all;
    background-color: black;

    .meta-key {
      display: inline-block;
      padding: 4px;
    }
    .meta-value {
      display: inline-block;
      font-family: 'Courier New', Courier, monospace;
      font-size: smaller;
      padding: 4px;
      color: #0f0;
    }
  }

  /* filter: invert(1); */
  /* filter: drop-shadow(2px 2px #999); */

`;

/**
 * @typedef {{}} Props
 */

/**
 * @typedef State
 * @property {HTMLDivElement} rootEl
 * @property {boolean} open Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {() => void} hide
 * @property {(e: React.MouseEvent) => void} onContextMenu
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {(at: Geom.VectJson) => void} show
 */
