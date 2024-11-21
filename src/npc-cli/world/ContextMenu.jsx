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

  const tags = lastMeta ? Object.keys(lastMeta).filter(k => lastMeta[k] === true) : [];
  const kvs = Object.entries(lastMeta ?? {}).filter(([k, v]) => v !== true);

  return (
    <div
      className={contextMenuCss}
      ref={state.rootRef}
      // 🔔 'visibility' permits computing menuDim.height
      style={{ visibility: state.open ? 'visible' : 'hidden' }}
      onContextMenu={state.onContextMenu}
    >
      {/* <div className="buttons">
        <button>open</button>
      </div> */}
      <div className="tags">
        {tags.map(tag => (
          <div key={tag} className="key-value">
            <span className="meta-key">{tag}</span>
          </div>
        ))}
      </div>
      <div className="key-values">
       {kvs.map(([key, value]) =>
          <div key={key} className="key-value">
            <span className="meta-key">{key}</span>
            <span className="meta-value">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
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
  
  display: flex;
  flex-direction: column;
  gap: 0px;

  pointer-events: none;
  
  opacity: 0.8;
  font-size: 0.8rem;
  color: white;
  background-color: #222;
  border: 1px solid #fff;

  button {
    border: 1px solid #aaa;
    color: black;
    background-color: white;
    padding: 0 4px;
    pointer-events: all;
  }

  div.key-values {
    display: flex;
    flex-direction: column;

    overflow: hidden;
    background-color: inherit;
  }
  
  .tags {
    display: flex;
    flex-wrap: wrap;
  }

  .key-value {
    display: flex;
    align-items: baseline;
    border: 1px solid white;

    pointer-events: all;
    background-color: black;

    .meta-key {
      padding: 4px;
    }
    .meta-value {
      font-family: 'Courier New', Courier, monospace;
      padding: 4px;
      color: #0f0;
      max-width: 128px;
    }
  }

  /* filter: sepia(1); */

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
