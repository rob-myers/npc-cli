import React from "react";
import { css, cx } from "@emotion/css";

import useSite from "src/store/site.store";
import { State } from "./Tabs";
import Spinner from "../Spinner";
import { FontAwesomeIcon, faCirclePause, faRefresh, faMaximize } from "../Icon";

export default function Controls({ api }: Props) {
  const browserLoaded = useSite((x) => x.browserLoaded);

  return (
    <div>
      <button className={cx(enableButtonCss, { enabled: api.enabled })} onClick={api.toggleEnabled}>
        {browserLoaded ? "interact" : <Spinner size={24} />}
      </button>
      <div className={cx(otherButtonsCss, { enabled: api.enabled, everEnabled: api.everEnabled })}>
        <button>
          <FontAwesomeIcon icon={faRefresh} size="2x" style={{ transform: "scale(0.7)" }} />
        </button>
        <button>
          <FontAwesomeIcon icon={faMaximize} size="2x" style={{ transform: "scale(0.7)" }} />
        </button>
        <button style={{ backgroundColor: "black" }}>
          <FontAwesomeIcon icon={faCirclePause} size="2x" inverse />
        </button>
      </div>
      <div
        className={cx(overlayCss, {
          clear: api.overlayColor === "clear",
          faded: api.overlayColor === "faded",
        })}
      />
    </div>
  );
}

interface Props {
  api: State;
}

const enableButtonCss = css`
  position: absolute;
  z-index: 5;
  left: calc(50% - 0.5 * (2 * 32px + 72px));
  top: calc(50% - 0.5 * (2 * 16px + 1rem));

  cursor: pointer;
  color: #ddd;
  background: rgba(0, 0, 0, 0.9);
  padding: 15px 32px;
  border-radius: 4px;
  border: 2px solid #888;
  font-size: 1rem;
  letter-spacing: 2px;

  display: flex;
  justify-content: center;
  align-items: center;

  &.enabled {
    display: none;
  }
`;

const otherButtonsCss = css`
  position: absolute;
  z-index: 5;
  right: calc(3rem);
  top: calc(-1 * 2rem - 4px);
  padding: 0;

  button {
    padding: 0;
    border: none;
    background-color: white;
    border: 4px solid black;
    border-radius: 50%;
    margin-left: 4px;
  }

  &:not(.everEnabled) {
    display: none;
  }
`;

const overlayCss = css`
  position: absolute;
  z-index: 4;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(1, 1, 1, 0.5); // 🚧 alpha should be 1
  font-family: sans-serif;

  &:not(.faded) {
    pointer-events: none;
  }

  opacity: 1;
  transition: opacity 1s ease-in;
  &.clear {
    opacity: 0;
    transition: opacity 0.5s ease-in;
  }
  &.faded {
    opacity: 0.5;
    transition: opacity 0.5s ease-in;
  }
`;
