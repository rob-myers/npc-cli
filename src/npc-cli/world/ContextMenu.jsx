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

  const kvs = React.useMemo(() => 
    Object.entries(lastMeta ?? {}).map(([k, v]) => {
      const vStr = v === true ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
    }).sort((a, b) => a.length < b.length ? -1 : 1)
  , [lastMeta]);

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
      <div className="kvs">
        {kvs.map(({ k, v }) => (
          <div key={k} className="key-value">
            <span className="meta-key">{k}</span>
            {v !== '' && <span className="meta-value">{v}</span>}
          </div>
        ))}
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

  .kvs {
    display: flex;
    flex-wrap: wrap;
    width: 200px;
  }

  .key-value {
    display: flex;
    /* align-items: center; */
    justify-content: space-around;

    flex: 1;
    border: 1px solid white;
    font-family: 'Courier New', Courier, monospace;

    pointer-events: all;
    background-color: black;

    .meta-key {
      padding: 4px;
    }
    .meta-value {
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
