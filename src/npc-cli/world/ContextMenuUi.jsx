import React from "react";
import { css } from "@emotion/css";

/**
 * @param {import("./ContextMenus").ContextMenuProps} props 
 */
export function DefaultContextMenu({ cm, cm: { ui } }) {

  return <>
  
    <div className="links" onClick={cm.onClickLink.bind(cm)}>
      {cm.npcKey !== undefined && <div className="npc-key" data-key="clear-npc">
        {'['}<span>{cm.npcKey}</span>{']'}
      </div>}

      <button data-key="toggle-docked">{cm.docked ? 'embed' : 'dock'}</button>

      {(cm.docked ? topLinks.docked : topLinks.embedded).map(({ key, label, test }) =>
        <button
          key={key}
          data-key={key}
          className={test !== undefined && !(/** @type {*} */ (cm)[test]) ? 'off' : undefined}
        >
          {label}
        </button>
      )}
      {ui.links.map(({ key, label, test }) =>
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
      {ui.kvs.map(({ k, v }) => (
        <div key={k} className="kv">
          <span className="key">{k}</span>
          {v !== '' && <span className="value">{v}</span>}
        </div>
      ))}
    </div>}

  </>;
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
    border: 1px solid #dddddd77;
  }

  &.docked {
    transform: unset !important;
    top: unset;
    bottom: 0;
  }

  .npc-key {
    cursor: pointer;

    span {
      color: #99ff99;
      pointer-events: none;
    }
    padding: 5px 6px;
  }

  color: #fff;
  letter-spacing: 1px;
  font-size: smaller;

  .links {
    display: flex;
    flex-wrap: wrap;
    
    line-height: normal;
    gap: 0px;
    /* padding-left: 4px; */
  }
  
  button {
    text-decoration: underline;
    color: #aaf;
    padding: 5px 6px;
    flex: 1;
  }
  button.off {
    filter: brightness(0.7);
  }

  .kvs {
    display: flex;
    flex-wrap: wrap;
  }

  .kv {
    display: flex;
    justify-content: space-around;
    align-items: center;

    flex: 1;
    border: 1px solid #555;
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

/**
 * @param {import("./ContextMenus").ContextMenuProps} props 
 */
export function NpcContextMenu({ cm }) {
  return (
    <div className="bubble" onClick={cm.onClickLink.bind(cm)}>

      <div className="main">
        <button
          className="npc-key"
          data-key="npc-key"
        >
          {cm.npcKey}
        </button>

        <div className="speech">
          {cm.ui.speech}
        </div>
      </div>

      <div className="links">
        {cm.ui.links.map(({ key, label, test }) =>
          <button
            key={key}
            data-key={key}
            className={test !== undefined && !(/** @type {*} */ (cm)[test]) ? 'off' : undefined}
          >
            {label}
          </button>
        )}
      </div>

    </div>
  );
}

export const npcContextMenuCss = css`
  --menu-width: 200px;

  position: absolute;
  top: 0;
  left: calc(-1/2 * var(--menu-width));
  transform-origin: 0 0;
  background: transparent !important;
  pointer-events: none;

  > div {
    transform-origin: calc(+1/2 * var(--menu-width)) 0;
    width: var(--menu-width);
    display: flex;
    justify-content: center;
  }
  
  .bubble {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    
    padding: 4px 8px;
    font-size: 1rem;
    color: white;
    /* background-color: #99999966; */
    
    transition: width 300ms;
    width: 100%;
  }
  
  .main {
    display: flex;
    gap: 4px;
  }

  .npc-key {
    pointer-events: all;
    cursor: pointer;
    word-break: break-all;
    background-color: #33ff3333;
    font-family: 'Courier New', Courier, monospace;
    padding: 0 4px;
  }
  
  .speech {
    font-weight: lighter;
    font-style: italic;
  }


  .links {
    pointer-events: all;
    cursor: pointer;

    display: flex;
    gap: 4px;
    font-size: 0.7rem;

    button {
      text-decoration: underline;
    }
    button.off {
      filter: brightness(0.7);
    }
  }
`;
