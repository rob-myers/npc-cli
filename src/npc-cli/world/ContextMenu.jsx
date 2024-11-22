import React from "react";
import { css, cx } from "@emotion/css";
import { zIndex } from "../service/const";
import { geom } from "../service/geom";
import { toXZ } from "../service/three";
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
    selectedActKey: null,

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

  w.cm = state;
  React.useMemo(() => void /** @type {React.RefCallback<State>} */ (ref)?.(state), [ref]);
  const update = useUpdate();

  const { lastDown } = w.view;
  const meta = lastDown?.meta;

  const kvs = React.useMemo(() => 
    Object.entries(meta ?? {}).map(([k, v]) => {
      const vStr = v === true ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
    }).sort((a, b) => a.length < b.length ? -1 : 1)
  , [meta]);

  const nearbyNpcKeys = React.useMemo(() => {
    if (lastDown !== undefined && typeof meta?.gmId === 'number' && typeof meta.roomId === 'number') {
      return w.e.getNearbyNpcKeys(meta.gmId, meta.roomId, toXZ(lastDown.position));
    } else {
      return [];
    }
  }, [meta]);
  
  const metaActs = meta !== undefined ? w.e.getMetaActs(meta) : [];

  const noNearbyNpcs = nearbyNpcKeys.length === 0;
  const noMetaActs = metaActs.length === 0;

  return (
    <div
      className={contextMenuCss}
      ref={state.rootRef}
      // 🔔 'visibility' permits computing menuDim.height
      style={{ visibility: state.open ? 'visible' : 'hidden' }}
      onContextMenu={state.onContextMenu}
    >
      <div className="actor-and-actions">

        <select className={cx("actor", { empty: noNearbyNpcs })}>
          <option disabled selected={noNearbyNpcs}>
            nearby npc
          </option>
          {nearbyNpcKeys.map(npcKey => <option key={npcKey} value={npcKey} >{npcKey}</option>)}
        </select>

        <div
          className="actions"
          onClick={e => {
            const item = /** @type {HTMLElement} */ (e.target);
            const index = Array.from(e.currentTarget.childNodes).indexOf(item);
            if (index !== -1)  state.selectedActKey = metaActs[index];
            update();
          }}
        >
          {metaActs.map(act =>
            <div key={act} className={cx("action", { selected: state.selectedActKey === act })}>
              {act}
            </div>
          )}
        </div>
      </div>

      <div className="key-values">
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
  z-index: ${zIndex.contextMenu};
  
  display: flex;
  flex-direction: column;

  font-size: 0.8rem;
  color: white;
  background-color: #222222aa;
  border: 1px solid #fff;

  /* user-select: none; */
  
  .actor-and-actions {
    display: flex;

    select.actor {
      pointer-events: all;
      border: 1px solid #aaa;
      padding: 2px 4px;
      flex: 1;
      color: #ddd;
      background-color: black;
      &.empty {
        color: #aaa;
      }
    }
    
    .actions {
      flex: 2;
      padding: 2px;
      color: #fff;
      background-color: #000;
    }

    .action {
      padding: 0 2px;
      cursor: pointer;
      color: #ddd;
      &:hover {
        background-color: #433;
      }
    }
    
    .action.selected {
      color: #fff;
      background-color: #433;
    }
  }


  .key-values {
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
 * @property {null | NPC.MetaActKey} selectedActKey
 * @property {boolean} open Is the context menu open?
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {() => void} hide
 * @property {(e: React.MouseEvent) => void} onContextMenu
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {(at: Geom.VectJson) => void} show
 */
