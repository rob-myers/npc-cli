import React from "react";
import { css, cx } from "@emotion/css";
import { PopUp } from "../components/PopUp";

/**
 * @param {{ cm: NPC.DefaultContextMenuType }} props 
 */
export function DefaultContextMenu({ cm }) {

  return <div onClick={cm.onClickLink.bind(cm)}>

    <div className={cx({ hidden: cm.npcKey === undefined }, "npc-key")} data-key="clear-npc">
      @<span>{cm.npcKey}</span>
    </div>
  
    <div className="links">

      <button data-key="toggle-docked">
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

        <button onClick={cm.refreshPopup.bind(cm)}>
          refresh
        </button>
      </PopUp>

      {(cm.docked ? topLinks.docked : topLinks.embedded).map(({ key, label, test }) =>
        <button
          key={key}
          data-key={key}
          className={test !== undefined && !(/** @type {*} */ (cm)[test]) ? 'off' : undefined}
        >
          {label}
        </button>
      )}
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

/** @type {Record<'embedded' | 'docked', NPC.ContextMenuLink[]>} */
const topLinks = {
  embedded: [
    { key: 'toggle-kvs', label: 'meta', test: 'showKvs' },
    { key: 'toggle-pinned', label: 'pin', test: 'pinned' },
    { key: 'toggle-scaled', label: 'scale', test: 'scaled' },
  ],
  docked: [
    { key: 'toggle-kvs', label: 'meta', test: 'showKvs' },
    { key: 'toggle-pinned', label: 'pin', test: 'pinned' },
  ],
};

export const defaultContextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  background: transparent !important;
  
  opacity: 0.8;

  > div {
    transform-origin: 0 0;
    width: 200px;
    background-color: #000;
    /* border: 1px solid #dddddd55; */
  }

  .npc-key {
    cursor: pointer;
    position: absolute;
    top: -24px;
    height: 24px;

    background-color: black;
    border: 1px solid #dddddd77;
    span {
      color: #99ff99;
      pointer-events: none;
    }
    padding: 0 5px;
  }
  .npc-key.hidden {
    display: none;
  }

  &.docked {
    transform: unset !important;
    top: unset;
    left: unset;
    right: 0;
    bottom: calc(64px + 12px);
    > div {
      padding-bottom: 12px;
    }
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
  }

  .kv {
    display: flex;
    /* justify-content: space-around; */
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
