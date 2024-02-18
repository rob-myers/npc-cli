import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import useSite from "src/store/site.store";
import useLongPress from "src/js/hooks/use-long-press";
import { afterBreakpoint, breakpoint } from "./const";

import { State } from "./Viewer";
import Spinner from "./Spinner";
import {
  FontAwesomeIcon,
  faRefreshThin,
  faExpandThin,
  faCirclePauseThin,
  faCompress,
} from "./Icon";
import Toggle from "./Toggle";
import useUpdate from "src/js/hooks/use-update";
import useStateRef from "src/js/hooks/use-state-ref";

export default function ViewerControls({ api }: Props) {
  const {
    browserLoaded,
    viewFull: fullViewSize,
    viewOpen,
  } = useSite(
    ({ browserLoaded, viewOpen, viewFull }) => ({ browserLoaded, viewOpen, viewFull }),
    shallow
  );

  const state = useStateRef(() => ({
    onLongReset() {
      api.tabs.hardReset();
      update();
    },
    onReset() {
      api.tabs.reset();
      update();
    },
    onEnable() {
      api.tabs.toggleEnabled(true);
      update();
    },
    onPause() {
      api.tabs.toggleEnabled(false);
      update();
    },
  }));

  const resetHandlers = useLongPress({
    onLongPress: state.onLongReset,
    onClick: state.onReset,
    ms: 1000,
  });

  const update = useUpdate();

  return (
    <div>
      <Toggle
        onClick={api.toggleCollapsed}
        className={cx(viewerToggleCss, { collapsed: !viewOpen })}
        flip={!viewOpen ? "horizontal" : undefined}
      />

      {viewOpen && (
        <button
          onClick={state.onEnable}
          className={cx(centeredOverlayCss, { enabled: api.tabs.enabled })}
        >
          {browserLoaded ? "interact" : <Spinner size={24} />}
        </button>
      )}

      <div className={otherButtonsCss}>
        <button title="pause tabs" onClick={state.onPause} disabled={!api.tabs.enabled}>
          <FontAwesomeIcon icon={faCirclePauseThin} size="1x" />
        </button>
        <button title="max/min tabs" onClick={() => useSite.api.toggleViewSize()}>
          <FontAwesomeIcon icon={fullViewSize ? faCompress : faExpandThin} size="1x" />
        </button>
        <button title="reset tabs" {...resetHandlers}>
          <FontAwesomeIcon icon={faRefreshThin} size="1x" />
        </button>
      </div>

      <div
        className={cx(darkOverlayCss, {
          clear: api.tabs.overlayColor === "clear",
          faded: api.tabs.overlayColor === "faded",
        })}
      />
    </div>
  );
}

interface Props {
  /** Viewer API */
  api: State;
}

const centeredOverlayCss = css`
  position: absolute;
  z-index: 5;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  background: rgba(0, 0, 0, 0);
  color: white;
  cursor: pointer;

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

const darkOverlayCss = css`
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

const viewerToggleCss = css`
  position: absolute;
  z-index: 6;
  border: 2px solid #000;
  background-color: #ddd;
  color: #000;
  /* width: 2rem;
  height: 2rem; */

  @media (min-width: ${afterBreakpoint}) {
    top: 0.4rem;
    left: -2.3rem;

    &.collapsed {
      left: 1rem;
      background-color: #fff;
      color: #000;
    }
  }

  @media (max-width: ${breakpoint}) {
    transform: rotate(90deg);
    top: -2.2rem;
    right: 0.5rem;

    &.collapsed {
      top: 0.9rem;
      background-color: white;
      color: #000;
    }
  }
`;
