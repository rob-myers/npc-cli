import { css } from "@emotion/css";
import React from "react";
import npcCliTitle from "../../static/assets/npc-cli-title.png";

export default function Title() {
  return (
    <div className={rootCss}>
      <img src={npcCliTitle} />
    </div>
  );
}

const rootCss = css`
  margin: 2rem 0;
  img {
    height: 6rem;
  }
`;
