import React from "react";
import { css } from "@emotion/css";

/** @param {Props} props */
export default function HelloWorld(props) {
  return (
    <div className={helloWorldCss}>Hello, world! ({props.disabled ? "disabled" : "enabled"})</div>
  );
}

const helloWorldCss = css`
  color: white;
  padding: 24px;
  height: 100%;
`;

/**
 * @typedef {import("src/components/tabs/tabs.util").BaseComponentProps} Props
 */
