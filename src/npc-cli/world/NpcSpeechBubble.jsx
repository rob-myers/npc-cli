import React from "react";
import { css } from "@emotion/css";

/**
 * @param {{ cm: NPC.NpcSpeechBubbleType }} props 
 */
export function NpcSpeechBubble({ cm }) {
  return (
    <div className="bubble">
      <div className="speech">
        {cm.speech}
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
  
  pointer-events: none;
  background: transparent !important;

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
    
    font-size: 1rem;
    color: white;
    /* background-color: #99999966; */
    
    transition: width 300ms;
  }

  .speech {
    font-weight: lighter;
    font-style: italic;
    font-size: 1rem;

    display: -webkit-box;
    justify-content: center;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; 
    overflow: hidden;

    text-align: center;
  }
`;
