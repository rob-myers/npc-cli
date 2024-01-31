import { css } from "@emotion/css";
import React from "react";

export default function Title() {
  return <div className={rootCss}>NPC CLI</div>;
}

const rootCss = css`
  margin: 2rem 0;
  font-size: 3rem;
  /* line-height: 1; */
`;
