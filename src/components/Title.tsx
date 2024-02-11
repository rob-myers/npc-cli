import { css, cx } from "@emotion/css";
import React from "react";
import npcCliTitle from "../../static/assets/npc-cli-title.png";

export default function Title() {
  return (
    <div className={cx("title", titleCss)}>
      <img src={npcCliTitle} />
    </div>
  );
}

const titleCss = css`
  img {
    height: 4rem;
  }
`;
