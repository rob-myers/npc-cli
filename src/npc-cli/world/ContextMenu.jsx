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
    mini: false,
    open: false,
    persist: true,
    resize: false,
    tracked: null,
    
    kvs: [],
    meta: {},
    metaActs: [],
    nearNpcKeys: [],
    position: [0, 0, 0],
    selectedActKey: null,

    calculatePosition(el, camera, size) {
      const objectPos = tmpVector3.setFromMatrixPosition(
        // 🤔 support tracked offset vector?
        state.tracked === null ? el.matrixWorld : state.tracked.matrixWorld
      );
      objectPos.project(camera);
      const widthHalf = size.width / 2;
      const heightHalf = size.height / 2;
      return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
    },
    hide() {
      state.open = false;
      closeSideNote(state.bubble, 0);
      update();
    },
    hideUnlessPersisted() {
      !state.persist && state.hide();
    },
    isTracking(npcKey) {
      return state.tracked !== null && state.meta.npcKey === npcKey;
    },
    onClickActions(e) {
      const item = /** @type {HTMLElement} */ (e.target);
      const index = Array.from(e.currentTarget.childNodes).indexOf(item);
      if (index !== -1) {
        state.selectedActKey = state.metaActs[index];
        update();
      }
    },
    onToggleMini() {
      state.mini = !state.mini;
      update();
    },
    onToggleResize() {
      state.resize = !state.resize;
      w.r3f.advance(Date.now());
      update();
    },
    rootRef(el) {
      if (el !== null) {
        state.rootEl = el;
      }
    },
    show() {
      state.open = true;
      state.updateFromLastDown();
      if (isSideNoteOpen(state.bubble)) {
        closeSideNote(state.bubble, 0);
        pause(200).then(() => openSideNote(state.bubble));
      }
      update();
    },
    togglePersist() {
      state.persist = !state.persist;
      update();
    },
    topBarRef(el) {
      if (el !== null) {
        state.bubble = /** @type {HTMLElement} */ (el.querySelector('.side-note-bubble'));
      }
    },
    track(input) {
      if (input instanceof THREE.Object3D) {
        state.tracked = input;
      } else {
        state.tracked = null;
      }
    },
    updateFromLastDown() {
      const { lastDown } = w.view;
      if (lastDown === undefined) {
        return;
      }

      state.meta = lastDown.meta;
  
      state.kvs = Object.entries(state.meta ?? {}).map(([k, v]) => {
        const vStr = v === true ? '' : typeof v === 'string' ? v : JSON.stringify(v);
        return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
      }).sort((a, b) => a.length < b.length ? -1 : 1);
  
      state.nearNpcKeys = (
        (typeof state.meta?.gmId === 'number' && typeof state.meta.roomId === 'number')
          ? w.e.getNearbyNpcKeys(state.meta.gmId, state.meta.roomId, toXZ(lastDown.position))
          : []
      );
  
      state.metaActs = w.e.getMetaActs(state.meta);
      
      // track npc if meta.npcKey valid
      state.track(w.n[state.meta.npcKey]?.m.group);
      state.position = lastDown.position.toArray();
    },
  }));

  w.cm = state;
  const update = useUpdate();

  const canAct = state.nearNpcKeys.length > 0 && state.metaActs.length > 0;

  return <>
    <Html
      className="context-menu"
      calculatePosition={state.calculatePosition}
      distanceFactor={state.resize ? 4 : undefined}
      position={state.position}
      visible={state.open}
      zIndexRange={[0]} // behind "disable" overlay
    >
      <div
        className={contextMenuCss}
        ref={state.rootRef}
        // 🔔 visibility for computing menuDim.height
        style={{ visibility: state.open ? 'visible' : 'hidden' }}
      >

        <div
          className={cx("top-bar", { mini: state.mini })}
          ref={state.topBarRef}
        >

          <div className="options">
            <SideNote onlyOnClick width={300}>
              <div className="controls">

                <button
                  onClick={state.onToggleMini}
                  className={cx({ disabled: !state.mini })}
                >
                  mini
                </button>

                <button
                  onClick={state.onToggleResize}
                  className={cx({ disabled: !state.resize })}
                >
                  resize
                </button>

              </div>
            </SideNote>
          </div>

          <button
            className={cx("persist-button", { disabled: !state.persist })}
            onClick={state.togglePersist}
            title="persist"
          >
            📌
          </button>

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

        {!state.mini && <div className="key-values">
          {state.kvs.map(({ k, v }) => (
            <div key={k} className="key-value">
              <span className="meta-key">{k}</span>
              {v !== '' && <span className="meta-value">{v}</span>}
            </div>
          ))}
        </div>}

      </div>
    </Html>
    <mesh
      position={state.position}
      visible={state.open === true && state.tracked === null}
    >
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshBasicMaterial color="red" />
    </mesh>
  </>;

}

const closeButtonRadius = `${14}px`;

const contextMenuCss = css`
  /* otherwise it is centred */
  position: absolute;
  left: 20px;
  top: 0;

  display: flex;
  flex-direction: column;

  font-size: 0.8rem;
  color: #ddd;
  background-color: #222222dd;
  /* border: 1px solid #aaa; */

  .top-bar {
    /* position: absolute; */
    /* top: calc(-2 * ${closeButtonRadius}); */
    right: 0;
    display: flex;
    justify-content: start;
    opacity: 0.8;
    gap: 4px;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    width: 100%;
  }

  .mini {
    .options .side-note, .persist-button, .close-button {
      border-bottom-width: 1px;
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
    font-size: calc(${closeButtonRadius} * 1.2);
    background-color: #000;
    color: #fff;
    border: 1px solid #7d7;
    border-bottom-width: 0;
  }

  .options .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    button {
      background: white;
      color: black;
      padding: 2px 4px;
      border-radius: 4px;
    }

    button.disabled {
      filter: brightness(0.5);
    }
  }

  .options .control {
    display: flex;
    gap: 4px;
  }

  .close-button, .persist-button {
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
    background-color: #000;
    color: #fff;
  }
  .close-button {
    border: 1px solid #d77;
    border-bottom-width: 0;
  }
  .persist-button {
    border: 1px solid #77d;
    border-bottom-width: 0;
  }
  .persist-button.disabled {
    filter: brightness(0.5);
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
 * @property {HTMLDivElement} rootEl
 * @property {HTMLElement} bubble For options
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} open Is the context menu open?
 * @property {boolean} mini
 * @property {boolean} persist
 * @property {boolean} resize
 * @property {null | THREE.Object3D} tracked
*
* @property {null | NPC.MetaActKey} selectedActKey
* @property {{ k: string; v: string; length: number }[]} kvs
* @property {string[]} nearNpcKeys
* @property {Geom.Meta} meta
* @property {NPC.MetaActKey[]} metaActs
* @property {THREE.Vector3Tuple} position
* 
* @property {(el: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => number[]} calculatePosition
* @property {() => void} hide
* @property {() => void} hideUnlessPersisted
* @property {(npcKey: string) => boolean} isTracking
* @property {() => void} onToggleMini
* @property {() => void} onToggleResize
* @property {(e: React.MouseEvent) => void} onClickActions
* //@property {(e: React.MouseEvent) => void} onContextMenu
 * @property {() => void} togglePersist
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {() => void} show
 * @property {(el: null | HTMLElement) => void} topBarRef
 * @property {(el: null | THREE.Object3D) => void} track
 * @property {() => void} updateFromLastDown
 */

const tmpVector3 = new THREE.Vector3();
