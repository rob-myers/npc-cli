import React from "react";
import { css, cx } from "@emotion/css";
import * as THREE from "three";

import { pause } from "../service/generic";
import { getDecorIconUrl } from "../service/fetch-assets";
import { PopUp } from "../components/PopUp";
import { Html3d, objectScale } from '../components/Html3d';
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useOnResize from "../hooks/use-on-resize";

export default function ContextMenu() {

  const w = React.useContext(WorldContext);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    rootEl: /** @type {*} */ (null),
    html: /** @type {*} */ (null),
    popup: /** @type {*} */ (null),

    everOpen: false,
    lastAct: null,
    npcKey: null,
    open: false,
    persist: true,
    scale: 1,
    scaled: false,
    showMeta: true,
    tracked: null,
    
    kvs: [],
    meta: {},
    metaActs: [],
    normal: null,
    npcKeys: [],
    position: [0, 0, 0],
    quaternion: null,
    shownDown: null,

    calculatePosition(el, camera, size) {
      // 🤔 support tracked offset vector?
      const objectPos = tmpVector1.setFromMatrixPosition(
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
      w.view.rootEl.focus();
      update();
    },
    hideUnlessPersisted() {
      !state.persist && state.hide();
    },
    isTracking(npcKey) {
      return state.tracked !== null && state.meta.npcKey === npcKey;
    },
    onClickActions(e) {
      const img = /** @type {HTMLElement} */ (e.target);
      const index = Number(img.dataset.index);
      const act = state.metaActs[index];

      if (act === undefined || state.npcKey === null) {
        return console.warn(`${'onClickActions'}: ignored`, { index, act, npcKey: state.npcKey });
      }

      state.lastAct = act;
      state.setSelectedActColor('white');

      w.events.next({
        key: 'click-act',
        act,
        npcKey: state.npcKey,
        point: { x: state.position[0], y: state.position[2] },
      });
      update();
    },
    onSelectNpc(e) {
      state.npcKey = e.currentTarget.value;
      update();
    },
    onToggleMeta() {
      state.showMeta = !state.showMeta;
      update();
    },
    onToggleResize() {
      state.scaled = !state.scaled;
      state.scale = 1 / objectScale(state.html.group, w.r3f.camera);
      update();
    },
    onWindowResize() {
      setTimeout(state.html.forceUpdate, 30);
    },
    setSelectedActColor(color) {
      state.rootEl.style.setProperty('--selected-act-color', color);
    },
    show() {
      state.open = true;

      if (state.popup.opened === true) {
        // 🔔 reopen on next render to "get direction right" 
        state.popup.close();
        pause(200).then(() => state.popup.open());
      }

      if (state.everOpen === false) {
        // state.popup?.open(); // initially open
        state.everOpen = true;
      }

      w.events.next({ key: 'update-context-menu' });
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
    update,
  }));

  w.cm = state;
  
  React.useEffect(() => {// on turn off scaled while paused update style.transform 
    state.scaled === false && state.html.forceUpdate();
  }, [state.scaled]);

  // 🔔 handle discontinuous window resize
  useOnResize(state.onWindowResize);

  return <>
    <Html3d
      className="context-menu"
      calculatePosition={state.calculatePosition}
      distanceFactor={state.scaled ? state.scale : undefined}
      position={state.position}
      normal={state.normal ?? undefined} // for hiding
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
                  className={cx({ disabled: !state.persist })}
                  onClick={state.togglePersist}
                  title="persist"
                >
                  pin
                </button>
                <button
                  onClick={state.onToggleResize}
                  className={cx({ disabled: !state.scaled })}
                >
                  scaled
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

          <button className="close-button" onClick={state.hide}>
            x
          </button>

        </div>

        <div className="actor-and-actions">

          {state.npcKey !== null && <select
            className="actor"
            value={state.npcKey}
            onChange={state.onSelectNpc}
          >
            {state.npcKeys.map(
              npcKey => <option key={npcKey} value={npcKey}>{npcKey}</option>
            )}
          </select>}

          <div
            className="actions"
            onClick={state.onClickActions}
          >
            {state.metaActs.map((act, actIndex) =>
              <button
                key={act.label}
                className={cx("action", { selected: state.lastAct === act })}
              >
                <img
                  src={getDecorIconUrl(act.icon)}
                  title={act.label}
                  width={24}
                  data-index={actIndex}
                />
              </button>
            )}
          </div>
        </div>

      </div>
    </Html3d>

    {state.quaternion !== null && (
      <group
        name="object-pick-circle"
        position={state.position}
        quaternion={state.quaternion}
        visible={state.open}
      >
        <mesh
          position={[0.01, 0, 0]}
          rotation={[0, Math.PI/2, 0]}
          renderOrder={1}
        >
          <circleGeometry args={[0.05, 24]} />
          <meshBasicMaterial color="green" opacity={0.5} transparent wireframe={false} />
        </mesh>
      </group>
    )}
  </>;

}

const closeButtonRadius = `${14}px`;

const contextMenuCss = css`
  --selected-act-color: white;
  --icon-size: 24px;

  position: absolute;
  left: 0;
  top: 0;
  
  pointer-events: none;
  button, select {
    pointer-events: all;
  }

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
    opacity: 0.8;
    gap: 4px;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    margin-bottom: 6px;
  }

  /* override side note opener */
  .options > .side-note {
    pointer-events: all;
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
    border-radius: 8px;
  }

  .options .info {
    font-size: smaller;
  }

  button.disabled {
    filter: brightness(0.5);
  }

  .options .controls {
    display: flex;
    justify-content: right;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;

    button {
      background: white;
      color: black;
      padding: 2px 4px;
    }
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
    background-color: #000;
    color: #fff;
    border-bottom-width: 1px;
    border-radius: 8px;
    border: 1px solid #d77;
  }
  .close-button {
    border-color: #d77;
  }

  .actor-and-actions {
    display: flex;
    flex-direction: column;
    align-items: start;

    select.actor {
      padding: 2px 4px;
      flex: 1;
      border: 1px solid #aaa;
      background-color: black;
      &.empty {
        color: #aaa;
      }
    }
    
    .actions {
      display: flex;
      flex-wrap: wrap;
      width: calc(24px * 6);
    }

    .action {
      display: flex;
      align-items: center;
      margin: 2px 4px;
      width: var(--icon-size);
    }
    
    .action.selected {
      &::after {
        content: "";
        position: absolute;
        background-color: var(--selected-act-color);
        opacity: 0.25;
        font-size: var(--icon-size);
        width: var(--icon-size);
        height: var(--icon-size);
      }
    }
  }

  .key-values {
    display: flex;
    flex-wrap: wrap;
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
 * @property {boolean} everOpen
 * @property {null | string} npcKey Currently select npc
 * @property {boolean} open Is the context menu open?
 * @property {boolean} showMeta
 * @property {boolean} persist
 * @property {boolean} scaled
 * @property {number} scale
 * @property {import('../components/PopUp').State} popup
 * @property {null | THREE.Object3D} tracked
 *
 * @property {null | NPC.MetaAct} lastAct
 * @property {{ k: string; v: string; length: number }[]} kvs
 * @property {null | NPC.DownData} shownDown
 * @property {Geom.Meta} meta
 * @property {NPC.DownData['normal']} normal
 * @property {NPC.MetaAct[]} metaActs
 * @property {string[]} npcKeys
 * @property {THREE.Vector3Tuple} position
 * @property {null | THREE.Quaternion} quaternion
 * 
 * @property {import('../components/Html3d').CalculatePosition} calculatePosition
 * @property {() => void} hide
 * @property {() => void} hideUnlessPersisted
 * @property {(npcKey: string) => boolean} isTracking
 * @property {(e: React.MouseEvent) => void} onClickActions
 * //@property {(e: React.MouseEvent) => void} onContextMenu
 * @property {(e: React.ChangeEvent<HTMLSelectElement>) => void} onSelectNpc
 * @property {() => void} onToggleMeta
 * @property {() => void} onToggleResize
 * @property {() => void} onWindowResize
 * @property {(color: string) => void} setSelectedActColor
 * @property {() => void} show
 * @property {() => void} togglePersist
 * @property {(el: null | THREE.Object3D) => void} track
 * @property {() => void} update
 */

const tmpVector1 = new THREE.Vector3();
