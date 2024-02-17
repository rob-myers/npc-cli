import React from "react";
import { css, cx } from "@emotion/css";

import useSite from "src/store/site.store";
import useLongPress from "src/js/hooks/use-long-press";
import { afterBreakpoint, breakpoint } from "../const";

import { State } from "./Tabs";
import Spinner from "../Spinner";
import {
  FontAwesomeIcon,
  faRefreshThin,
  faExpandThin,
  faCirclePauseThin,
  faCompress,
} from "../Icon";

export default function Controls({ api }: Props) {
  const browserLoaded = useSite((x) => x.browserLoaded);

  const resetHandlers = useLongPress({
    onLongPress: api.hardReset,
    onClick: api.reset,
    ms: 1000,
  });

  return (
    <div>
      <button
        title="enable tabs"
        onClick={() => api.toggleEnabled()}
        className={cx(enableButtonCss, { enabled: api.enabled })}
      >
        {browserLoaded ? "interact" : <Spinner size={24} />}
      </button>
      <div className={otherButtonsCss}>
        <button title="pause tabs" onClick={() => api.toggleEnabled()} disabled={!api.enabled}>
          <FontAwesomeIcon icon={faCirclePauseThin} size="1x" />
        </button>
        <button title="max/min tabs">
          <FontAwesomeIcon icon={api.expanded ? faCompress : faExpandThin} size="1x" />
        </button>
        <button title="reset tabs" {...resetHandlers}>
          <FontAwesomeIcon icon={faRefreshThin} size="1x" />
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
  border: 1px solid #888;
  font-size: 1rem;
  letter-spacing: 2px;
  user-select: none;

  display: flex;
  justify-content: center;
  align-items: center;

  opacity: 1;
  transition: opacity 500ms;
  &.enabled {
    pointer-events: none;
    opacity: 0;
  }
`;

const otherButtonsCss = css`
  position: absolute;
  z-index: 5;
  display: flex;

  flex-direction: column;
  background-color: #444;

  @media (min-width: ${afterBreakpoint}) {
    left: -3rem;
    top: 0;
    width: 3rem;
    height: 100%;

    button:nth-child(1) {
      margin-top: 2.5rem;
    }
  }

  @media (max-width: ${breakpoint}) {
    right: 0;
    top: -2.5rem;
    width: 100%;

    flex-direction: row;
    justify-content: right;

    button:nth-child(3) {
      margin-right: 3rem;
    }
  }

  button {
    background-color: rgba(0, 0, 0, 1);
    color: white;
    border: 1px solid #444;
    width: 3rem;
    height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: center;

    cursor: pointer;
    &:disabled {
      cursor: auto;
      color: #aaa;
    }
  }
`;

const overlayCss = css`
  position: absolute;
  z-index: 4;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(1, 1, 1, 1);
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
