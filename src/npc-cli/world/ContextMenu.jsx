import React from "react";
import { Html } from "@react-three/drei";
import { css, cx } from "@emotion/css";
import * as THREE from "three";
import { pause } from "../service/generic";
import { toXZ } from "../service/three";
import SideNote, { closeSideNote, openSideNote, isSideNoteOpen } from "../aux/SideNote";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { WorldContext } from "./world-context";

export default function ContextMenu() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    rootEl: /** @type {*} */ (null),
    bubble: /** @type {*} */ (null),
    justOpen: false,
    open: false,
    persist: { id: `w-${w.key}-cm-persist`, el: /** @type {HTMLInputElement} */ ({ checked: false }) },
    mini: { id: `w-${w.key}-cm-mini`, el: /** @type {HTMLInputElement} */ ({ checked: false }) },
    
    selectedActKey: null,
    kvs: [],
    nearNpcKeys: [],
    metaActs: [],
    position: [0, 0, 0],

    hide() {
      state.open = false;
      closeSideNote(state.bubble, 0);
      update();
    },
    hideUnlessPersisted() {
      !state.persist.el.checked && state.hide();
    },
    onClickActions(e) {
      const item = /** @type {HTMLElement} */ (e.target);
      const index = Array.from(e.currentTarget.childNodes).indexOf(item);
      if (index !== -1) {
        state.selectedActKey = state.metaActs[index];
        update();
      }
    },
    rootRef(el) {
      if (el !== null) {
        state.rootEl = el;
      }
    },
    show() {
      closeSideNote(state.bubble, 0);
      state.open = true;
      state.updateFromLastDown();
      if (isSideNoteOpen(state.bubble)) {
        pause(200).then(() => openSideNote(state.bubble));
      }
      update();
    },
    topBarRef(el) {
      if (el !== null) {
        state.bubble = /** @type {HTMLElement} */ (el.querySelector('.side-note-bubble'));
      }
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
  const showSummary = state.mini.el.checked === false;

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
        // 🔔 visibility for computing menuDim.height
        style={{ visibility: state.open ? 'visible' : 'hidden' }}
      >

        <div
          className={cx("top-bar", { mini: state.mini.el.checked })}
          ref={state.topBarRef}
        >

          <div className="options">
            <SideNote onlyOnClick width={300}>
              <div className="controls">

                <div className="control">
                  <label htmlFor={state.persist.id}>persist</label>
                  <input
                    type="checkbox"
                    id={state.persist.id}
                    ref={el => void (el && (state.persist.el = el))}
                  />
                </div>

                <div className="control">
                  <label htmlFor={state.mini.id}>mini</label>
                  <input
                    type="checkbox"
                    id={state.mini.id}
                    ref={el => void (el && (state.mini.el = el))}
                    onChange={update}
                  />
                </div>

              </div>
            </SideNote>
          </div>

          <button className="close-button" onClick={state.hide}>
            x
          </button>

        </div>

        {canAct && <div className="actor-and-actions">

          <select className="actor">
            {state.nearNpcKeys.map(npcKey => <option key={npcKey} value={npcKey} >{npcKey}</option>)}
          </select>

          <div
            className="actions"
            onClick={state.onClickActions}
          >
            {state.metaActs.map(act =>
              <div key={act} className={cx("action", { selected: state.selectedActKey === act })}>
                {act}
              </div>
            )}
          </div>
        </div>}

        {showSummary && <div className="key-values">
          {state.kvs.map(({ k, v }) => (
            <div key={k} className="key-value">
              <span className="meta-key">{k}</span>
              {v !== '' && <span className="meta-value">{v}</span>}
            </div>
          ))}
        </div>}

      </div>
    </Html>
  );

}

const closeButtonRadius = `${14}px`;

const contextMenuCss = css`
  /* otherwise it is centred */
  position: absolute;
  left: 0;
  /* right: 0; */
  top: 0;
  /* bottom: 0; */

  display: flex;
  flex-direction: column;

  font-size: 0.8rem;
  color: #ddd;
  background-color: #222222dd;
  /* border: 1px solid #aaa; */

  .top-bar {
    position: absolute;
    top: calc(-2 * ${closeButtonRadius});
    right: 1px;
    display: flex;
    justify-content: start;
    opacity: 0.8;
    gap: 4px;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    width: 100%;
  }

  .mini {
    .options .side-note, .close-button {
      border-bottom-width: 2px;
      border-radius: 8px;
    }
  }
  
  /* override side note opener */
  .options > .side-note {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-width: 32px;
    height: 100%;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border: 2px solid #7d7;
    border-bottom-width: 0;
    font-size: calc(${closeButtonRadius} * 1.2);
    background-color: #000;
    color: #fff;
  }

  .options .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .options .control {
    display: flex;
    gap: 4px;
  }

  .close-button {
    min-width: calc(${closeButtonRadius} + ${closeButtonRadius});
    min-height: calc(${closeButtonRadius} + ${closeButtonRadius});
    display: flex;
    justify-content: center;
    align-items: center;

    cursor: pointer;
    border-radius: calc(${closeButtonRadius} * 0.5);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: calc(${closeButtonRadius} * 1);
    border: 2px solid #d77;
    border-bottom-width: 0;
    background-color: #000;
    color: #fff;
  }

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
 * @property {HTMLElement} bubble
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} open Is the context menu open?
 * @property {HTMLDivElement} rootEl
 * @property {null | NPC.MetaActKey} selectedActKey
 * @property {OptionsControl} persist
 * @property {OptionsControl} mini
 *
 * @property {{ k: string; v: string; length: number }[]} kvs
 * @property {string[]} nearNpcKeys
 * @property {NPC.MetaActKey[]} metaActs
 * @property {THREE.Vector3Tuple} position
 * 
 * @property {() => void} hide
 * @property {() => void} hideUnlessPersisted
 * @property {(e: React.MouseEvent) => void} onClickActions
 * //@property {(e: React.MouseEvent) => void} onContextMenu
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {() => void} show
 * @property {(el: null | HTMLElement) => void} topBarRef
 * @property {() => void} updateFromLastDown
 */

/**
 * @typedef OptionsControl
 * @property {string} id
 * @property {HTMLInputElement} el
 */