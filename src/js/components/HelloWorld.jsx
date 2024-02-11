import React from "react";
import { css } from "@emotion/css";

/** @param {Props} props */
export default function HelloWorld(props) {
  return <div className={helloWorldCss}>Hello, world!</div>;
}

const helloWorldCss = css`
  padding: 24px;
  background-color: #ddd;
`;

/**
 * @typedef {import("src/components/tabs/tabs.util").BaseComponentProps} Props
 */
