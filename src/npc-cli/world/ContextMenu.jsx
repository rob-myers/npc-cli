import React from "react";
import { css, cx } from "@emotion/css";

import { Vect } from "../geom";
import { WorldContext } from "./world-context";
import { ContextMenuApi as ContextMenuApi } from "./menu-api";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import { PopUp } from "../components/PopUp";
import { Html3d } from "../components/Html3d";
import Draggable from "../components/Draggable";

export function ContextMenu() {

  const w = React.useContext(WorldContext);
  const cm = w.cm ??= new ContextMenuApi('default', w, { showKvs: true });
  cm.update = useUpdate();
  
  // Extra initial render: (a) init paused, (b) trigger CSS transition
  React.useEffect(() => void cm.update(), [cm.scaled]);

  React.useMemo(() => {// HMR
    if (process.env.NODE_ENV === 'development') {
      w.cm = Object.assign(new ContextMenuApi(cm.key, w, cm), {...cm})
      cm.dispose();
    }
  }, []);

  return (
    <Html3d
      ref={cm.html3dRef.bind(cm)}
      baseScale={cm.baseScale}
      className={defaultContextMenuCss}
      docked={cm.docked}
      open={cm.open}
      position={cm.position}
      tracked={cm.tracked}
    >
      {cm.docked === true && (
        <Draggable
          container={w.view.rootEl}
          initPos={cm.dockPoint}
          resizeSubject={w.view.resizeEvents}
        >
          <ContextMenuUi cm={cm} />
        </Draggable>
      )}
      
      {cm.docked === false && <ContextMenuUi cm={cm} />}
    </Html3d>
  );

}

/** @param {{ cm: ContextMenuApi }} _ */
function ContextMenuUi({ cm }) {

  const state = useStateRef(() => ({
    /** `cm.dockPoint` when on pointer down */
    downDockPoint: /** @type {undefined | Geom.VectJson} */ (undefined),
    /** Was pointerdown over contextmenu and not yet up? */
    isDown: false,

    /** @param {React.KeyboardEvent<HTMLButtonElement>} e */
    onKeyDownButton(e) {
      if (e.code === 'Space') {
        cm.onToggleLink(e);
        e.currentTarget.focus();
      }
    },
    /** @param {React.PointerEvent} e */
    onPointerUp(e) {
      const { downDockPoint, isDown } = state;
      state.downDockPoint = undefined;
      state.isDown = false;

      if (isDown === false) {
        return;
      } else if (cm.docked === false) {
        cm.onToggleLink(e);
      } else if (
        downDockPoint !== undefined &&
        tmpVect.copy(downDockPoint).distanceTo(cm.dockPoint) < 4
      ) {// docked click without drag
        cm.onToggleLink(e);
      } else {// dragged docked click
        cm.popUp.preventToggle = true;
        setTimeout(() => cm.popUp.preventToggle = false);
      }
    },
    /** @param {React.PointerEvent} e */
    onPointerDown(e) {
      state.isDown = true;
      state.downDockPoint = cm.docked ? {...cm.dockPoint} : undefined;
    },
  }), { deps: [cm] });

  return <div
    className="inner-root"
    onPointerUp={state.onPointerUp}
    onPointerDown={state.onPointerDown}
  >

    <div
      className={cx({ hidden: cm.npcKey === undefined }, "npc-key")}
      data-key="clear-npc"
    >
      @<span>{cm.npcKey}</span>
    </div>
  
    <div className="links">

      <button
        data-key="toggle-docked"
        onKeyDown={state.onKeyDownButton}
      >
        {cm.docked ? 'embed' : 'dock'}
      </button>

      <PopUp
        ref={cm.popUpRef.bind(cm)}
        infoClassName={popUpInfoCss}
        label="opts"
        onChange={cm.onTogglePopup.bind(cm)}
        width={200}
      >
        <select
          className="select-npc"
          onChange={cm.onSelectNpc.bind(cm)}
          value={cm.npcKey ?? ""}
        >
          <option value="">no npc</option>
          {cm.selectNpcKeys.map(npcKey => 
            <option value={npcKey}>{npcKey}</option>
          )}
        </select>

        <button
          key="toggle-scaled"
          data-key="toggle-scaled"
          className={!cm.scaled ? 'off' : undefined}
        >
          scale
        </button>

        {/* 🚧 avoid refresh i.e. auto-update npc list  */}
        {/* <button onClick={cm.refreshPopup.bind(cm)}>
          refresh
        </button> */}
      </PopUp>

      <button
        key="toggle-kvs"
        data-key="toggle-kvs"
        className={!cm.showKvs ? 'off' : undefined}
        onKeyDown={state.onKeyDownButton}
      >
        meta
      </button>

      <button
        key="toggle-pinned"
        data-key="toggle-pinned"
        className={!cm.pinned ? 'off' : undefined}
        onKeyDown={state.onKeyDownButton}
      >
        pin
      </button>

      {cm.links.map(({ key, label, test }) =>
        <button
          key={key}
          data-key={key}
          className={test !== undefined && !(/** @type {*} */ (cm)[test]) ? 'off' : undefined}
        >
          {label}
        </button>
      )}
    </div>

    {cm.showKvs === true && <div className="kvs">
      {cm.kvs.map(({ k, v }) => (
        <div key={k} className="kv">
          <span className="key">{k}</span>
          {v !== '' && <span className="value">{v}</span>}
        </div>
      ))}
    </div>}

  </div>;
}

const tmpVect = new Vect();

export const defaultContextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  background: transparent !important;
  pointer-events: none;
  
  opacity: 0.8;

  > div {
    transform-origin: 0 0;
    pointer-events: all;
    /* user-select: auto; */

    .inner-root {
      width: 200px;
      background-color: #000;
    }
  }

  .npc-key {
    cursor: pointer;
    position: absolute;
    top: -24px;
    height: 24px;

    background-color: black;
    span {
      color: #99ff99;
      pointer-events: none;
    }
    padding: 2px 6px;
  }
  .npc-key.hidden {
    display: none;
  }

  &.docked {
    z-index: 7; // 🚧
    transform: unset !important;
  }

  .select-npc {
    background-color: black;
    color: white;
    padding: 4px;
  }

  color: #fff;
  letter-spacing: 1px;
  font-size: smaller;

  .links {
    display: flex;
    flex-wrap: wrap;
    
    line-height: normal;
    gap: 0px;
  }
  
  .links > * {
    flex: 1;
  }

  .links button {
    text-decoration: underline;
    color: #aaf;
    padding: 5px 6px;
  }
  .links button.off {
    filter: brightness(0.7);
  }

  .kvs {
    display: flex;
    flex-wrap: wrap;
    padding: 4px;
  }

  .kv {
    display: flex;
    align-items: center;

    flex: 1;
    /* border: 1px solid #222; */
    /* font-family: 'Courier New', Courier, monospace; */

    .key {
      padding: 2px;
    }
    .value {
      padding: 0 4px;
      color: #cca;
      max-width: 128px;
    }
  }
`;

const popUpInfoCss = css`
  display: flex;
  justify-content: space-around;
  align-items: center;
  font-size: small;

  select {
    border: 1px solid #555;
  }
;`
