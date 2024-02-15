import React from "react";
import { css, cx } from "@emotion/css";

import useSite from "src/store/site.store";
import { State } from "./Tabs";
import Spinner from "../Spinner";

export default function Controls({ api }: Props) {
  const browserLoaded = useSite((x) => x.browserLoaded);

  return (
    <div className={cx(controlsCss, { enabled: api.enabled })}>
      <div className="centred-control" onClick={api.toggleEnabled}>
        {browserLoaded ? "interact" : <Spinner size={24} />}
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

const controlsCss = css`
  &.enabled .centred-control {
    display: none;
  }
  .centred-control {
    position: absolute;
    z-index: 5;
    left: calc(50% - (128px / 2));
    top: calc(50% - 20px);

    cursor: pointer;
    color: #ddd;
    background: rgba(0, 0, 0, 0.9);
    padding: 12px 32px;
    border-radius: 4px;
    border: 2px solid #888;
    font-size: 1rem;
    letter-spacing: 2px;

    display: flex;
    justify-content: center;
    align-items: center;
    width: 70px;
    max-height: 32px; // 🚧 not when collapsed
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
