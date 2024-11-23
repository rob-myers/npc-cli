import React from "react";
import { Html } from "@react-three/drei";
import { css, cx } from "@emotion/css";
import * as THREE from "three";
import { toXZ } from "../service/three";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { WorldContext } from "./world-context";

export default function ContextMenu() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    justOpen: false,
    open: false,
    rootEl: /** @type {*} */ (null),
    selectedActKey: null,

    kvs: [],
    nearNpcKeys: [],
    metaActs: [],
    position: [0, 0, 0],

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
    show() {
      state.open = true;
      state.updateFromLastDown();
      update();
    },
    updateFromLastDown() {
      const { lastDown } = w.view;
      
      if (lastDown === undefined) {
        return;
      }
      const meta = lastDown?.meta;
  
      state.kvs = Object.entries(meta ?? {}).map(([k, v]) => {
        const vStr = v === true ? '' : typeof v === 'string' ? v : JSON.stringify(v);
        return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
      }).sort((a, b) => a.length < b.length ? -1 : 1);
  
      state.nearNpcKeys = (
        (typeof meta?.gmId === 'number' && typeof meta.roomId === 'number')
          ? w.e.getNearbyNpcKeys(meta.gmId, meta.roomId, toXZ(lastDown.position))
          : []
      );
  
      state.metaActs = w.e.getMetaActs(meta);
  
      state.position = lastDown.position.toArray();
    },
  }));

  w.cm = state;
  const update = useUpdate();
  const canAct = state.nearNpcKeys.length > 0 && state.metaActs.length > 0;

  return (
    <Html
      visible={state.open}
      position={state.position}
      className="context-menu"
      zIndexRange={[0]} // behind "disable" overlay
    >
      <div
        className={contextMenuCss}
        ref={state.rootRef}
        // 🔔 'visibility' permits computing menuDim.height
        style={{ visibility: state.open ? 'visible' : 'hidden' }}
        onContextMenu={state.onContextMenu}
      >

        {canAct && <div className="actor-and-actions">

          <select className="actor">
            {state.nearNpcKeys.map(npcKey => <option key={npcKey} value={npcKey} >{npcKey}</option>)}
          </select>

          <div
            className="actions"
            onClick={e => {
              const item = /** @type {HTMLElement} */ (e.target);
              const index = Array.from(e.currentTarget.childNodes).indexOf(item);
              if (index !== -1)  state.selectedActKey = state.metaActs[index];
              update();
            }}
          >
            {state.metaActs.map(act =>
              <div key={act} className={cx("action", { selected: state.selectedActKey === act })}>
                {act}
              </div>
            )}
          </div>
        </div>}

        <div className="key-values">
          {state.kvs.map(({ k, v }) => (
            <div key={k} className="key-value">
              <span className="meta-key">{k}</span>
              {v !== '' && <span className="meta-value">{v}</span>}
            </div>
          ))}
        </div>

      </div>
    </Html>
  );

}

const contextMenuCss = css`
  /* otherwise it is centred */
  position: absolute;
  left: 0;
  top: 0;

  display: flex;
  flex-direction: column;

  font-size: 0.8rem;
  color: #ddd;
  background-color: #222222dd;
  border: 1px solid #aaa;

  /* user-select: none; */
  
  .actor-and-actions {
    display: flex;

    select.actor {
      pointer-events: all;
      border: 1px solid #aaa;
      padding: 2px 4px;
      flex: 1;
      background-color: black;
      &.empty {
        color: #aaa;
      }
    }
    
    .actions {
      flex: 2;
      padding: 2px;
      background-color: #000;
      display: flex;
      /* flex-wrap: wrap; */
    }
    
    .action {
      padding: 4px;
      cursor: pointer;
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
    justify-content: space-around;

    flex: 1;
    border: 1px solid #555;
    font-family: 'Courier New', Courier, monospace;

    .meta-key {
      padding: 4px;
    }
    .meta-value {
      padding: 4px;
      color: #cca;
      max-width: 128px;
    }
  }

  /* filter: grayscale(1) brightness(0.7); */
`;

/**
 * @typedef State
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} open Is the context menu open?
 * @property {HTMLDivElement} rootEl
 * @property {null | NPC.MetaActKey} selectedActKey
 *
 * @property {{ k: string; v: string; length: number }[]} kvs
 * @property {string[]} nearNpcKeys
 * @property {NPC.MetaActKey[]} metaActs
 * @property {THREE.Vector3Tuple} position
 * 
 * @property {() => void} hide
 * @property {(e: React.MouseEvent) => void} onContextMenu
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {() => void} show
 * @property {() => void} updateFromLastDown
 */
