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
      ref={(x) => void (x && (state.rootEl = x))}
      // 🔔 'visibility' permits computing menuDim.height
      style={{ visibility: state.open ? 'visible' : 'hidden' }}
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
  );

});

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

/**
 * @typedef {{}} Props
 */

/**
 * @typedef State
 * @property {HTMLDivElement} rootEl
 * @property {boolean} open Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {() => void} hide
 * @property {(at: Geom.VectJson) => void} show
 */
