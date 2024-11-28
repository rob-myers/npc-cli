import React from "react";
import { css, cx } from "@emotion/css";
import * as THREE from "three";

import { pause } from "../service/generic";
import { toXZ } from "../service/three";
import { PopUp } from "../components/PopUp";
import { Html3d, objectScale } from '../components/Html3d';
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useOnResize from "../hooks/use-on-resize";

export default function ContextMenu() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    rootEl: /** @type {*} */ (null),
    html: /** @type {*} */ (null),
    popup: /** @type {*} */ (null),
    justOpen: false,
    showMeta: true,
    open: false,
    persist: true,
    lock: false,
    scale: 1,
    tracked: null,
    
    kvs: [],
    meta: {},
    metaActs: [],
    nearNpcKeys: [],
    position: [0, 0, 0],
    selectedActKey: null,

    calculatePosition(el, camera, size) {
      // 🤔 support tracked offset vector?
      const objectPos = tmpVector3.setFromMatrixPosition(
        state.tracked === null ? el.matrixWorld : state.tracked.matrixWorld
      );
      objectPos.project(camera);
      const widthHalf = size.width / 2;
      const heightHalf = size.height / 2;
      return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
    },
    hide() {
      state.open = false;
      state.popup.close();
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
        state.selectedActKey = state.metaActs[index].actKey;
        update();
      }
    },
    onToggleMeta() {
      state.showMeta = !state.showMeta;
      update();
    },
    onToggleResize() {
      state.lock = !state.lock;
      state.scale = 1 / objectScale(state.html.group, w.r3f.camera);
      update();
    },
    onWindowResize() {
      setTimeout(state.html.forceUpdate, 30);
    },
    show() {
      state.open = true;
      state.updateFromLastDown();
      if (state.popup.opened) {
        state.popup.close(); // 🔔 wait for next render
        pause(200).then(() => state.popup.open());
      }
      update();
    },
    togglePersist() {
      state.persist = !state.persist;
      update();
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
  
  const canAct = state.nearNpcKeys.length > 0 && state.metaActs.length > 0;
  
  React.useEffect(() => {
    state.lock === false && state.html.forceUpdate();
  }, [state.lock]);
  
  React.useEffect(() => {// initially open
    state.open && state.popup?.open();
  }, [state.open]);
  
  const update = useUpdate();

  // 🔔 handle discontinuous window resize
  useOnResize(state.onWindowResize);

  return <>
    <Html3d
      className="context-menu"
      calculatePosition={state.calculatePosition}
      distanceFactor={state.lock ? state.scale : undefined}
      position={state.position}
      visible={state.open}
      ref={state.ref('html')}
    >
      <div
        className={contextMenuCss}
        ref={state.ref('rootEl')}
        // 🔔 visibility for computing menuDim.height
        style={{ visibility: state.open ? 'visible' : 'hidden' }}
      >

        <div className="top-bar">
          <div className="options">
            <PopUp
              ref={state.ref('popup')}
              width={300}
            >
              <div className="controls">
                <button
                  onClick={state.onToggleMeta}
                  className={cx({ disabled: !state.showMeta })}
                >
                  meta
                </button>

                <button
                  onClick={state.onToggleResize}
                  className={cx({ disabled: !state.lock })}
                >
                  lock
                </button>
              </div>

              {state.showMeta && <div className="key-values">
                {state.kvs.map(({ k, v }) => (
                  <div key={k} className="key-value">
                    <span className="meta-key">{k}</span>
                    {v !== '' && <span className="meta-value">{v}</span>}
                  </div>
                ))}
              </div>}

            </PopUp>
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
              <div key={act.actKey} className={cx("action", { selected: state.selectedActKey === act.actKey })}>
                {act.actLabel}
              </div>
            )}
          </div>
        </div>}

      </div>
    </Html3d>
    <mesh
      position={state.position}
      visible={state.open === true && state.tracked === null}
    >
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshBasicMaterial color="green" />
    </mesh>
  </>;

}

const closeButtonRadius = `${14}px`;

const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  
  @media(max-width: ${700}px) {
    left: 8px;
    top: 8px;
  }

  display: flex;
  flex-direction: column;

  font-size: 0.8rem;
  color: #ddd;

  .top-bar {
    right: 0;
    display: flex;
    justify-content: start;
    opacity: 0.8;
    gap: 4px;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    width: 100%;
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
    border-bottom-width: 1px;
    border-radius: 8px;
  }

  .options .info {
    font-size: smaller;
  }

  .options .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;

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
    border-bottom-width: 1px;
    border-radius: 8px;
    border: 1px solid #d77;
  }
  .close-button {
    border-color: #d77;
  }
  .persist-button {
    border-color: #77d;
  }

  .actor-and-actions {
    display: flex;
    flex-direction: column;
    align-items: start;

    select.actor {
      pointer-events: all;
      padding: 2px 4px;
      flex: 1;
      border: 1px solid #aaa;
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
    /* width: 200px; */
    margin-top: 8px;
  }

  .key-value {
    display: flex;
    justify-content: space-around;
    align-items: center;

    flex: 1;
    border: 1px solid #555;
    /* font-family: 'Courier New', Courier, monospace; */

    .meta-key {
      padding: 2px;
    }
    .meta-value {
      padding: 0 4px;
      color: #cca;
      max-width: 128px;
    }
  }

  /* filter: sepia(1); */
`;

/**
 * @typedef State
 * @property {HTMLDivElement} rootEl
 * @property {import('../components/Html3d').State} html
 * @property {boolean} justOpen Was the context menu just opened?
 * @property {boolean} open Is the context menu open?
 * @property {boolean} showMeta
 * @property {boolean} persist
 * @property {boolean} lock
 * @property {number} scale
 * @property {import('../components/PopUp').State} popup
 * @property {null | THREE.Object3D} tracked
*
* @property {null | NPC.MetaActKey} selectedActKey
* @property {{ k: string; v: string; length: number }[]} kvs
* @property {string[]} nearNpcKeys
* @property {Geom.Meta} meta
* @property {NPC.MetaAct[]} metaActs
* @property {THREE.Vector3Tuple} position
* 
* @property {import('../components/Html3d').CalculatePosition} calculatePosition
* @property {() => void} hide
* @property {() => void} hideUnlessPersisted
* @property {(npcKey: string) => boolean} isTracking
* @property {(e: React.MouseEvent) => void} onClickActions
* //@property {(e: React.MouseEvent) => void} onContextMenu
* @property {() => void} onToggleMeta
* @property {() => void} onToggleResize
* @property {() => void} onWindowResize
* @property {() => void} show
 * @property {() => void} togglePersist
 * @property {(el: null | THREE.Object3D) => void} track
 * @property {() => void} updateFromLastDown
 */

const tmpVector3 = new THREE.Vector3();
