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
    <>
      <button
        onClick={state.onEnable}
        className={cx(interactOverlayCss, { enabled: api.tabs.enabled, collapsed: !viewOpen })}
      >
        {browserLoaded ? "interact" : <Spinner size={24} />}
      </button>

      <div className={buttonsCss}>
        <button title="pause tabs" onClick={state.onPause} disabled={!api.tabs.enabled}>
          <FontAwesomeIcon icon={faCirclePauseThin} size="1x" />
        </button>
        <button title="max/min tabs" onClick={() => useSite.api.toggleViewSize()}>
          <FontAwesomeIcon icon={fullViewSize ? faCompress : faExpandThin} size="1x" />
        </button>
        <button title="reset tabs" {...resetHandlers}>
          <FontAwesomeIcon icon={faRefreshThin} size="1x" />
        </button>
        <Toggle
          onClick={api.toggleCollapsed}
          className={cx(viewerToggleCss, { collapsed: !viewOpen })}
          flip={!viewOpen ? "horizontal" : undefined}
        />
      </div>

      <div
        className={cx(faderOverlayCss, {
          clear: api.tabs.overlayColor === "clear",
          faded: api.tabs.overlayColor === "faded",
        })}
      />
    </>
  );
}

interface Props {
  /** Viewer API */
  api: State;
}

const interactOverlayCss = css`
  position: absolute;
  z-index: 5;

  @media (min-width: ${afterBreakpoint}) {
    left: 3rem;
    top: 0;
    width: calc(100% - 3rem);
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: 3rem;
    width: 100%;
    height: calc(100% - 3rem);
  }

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
  &.collapsed {
    display: none;
  }
`;

const buttonsCss = css`
  display: flex;
  justify-content: right;
  align-items: center;

  @media (min-width: ${afterBreakpoint}) {
    flex-direction: column-reverse;
    width: 3rem;
    height: 100%;
    border-right: 2px solid #444;
  }

  @media (max-width: ${breakpoint}) {
    right: 0;
    top: -3rem;
    height: 3rem;
    width: 100%;

    flex-direction: row;
    justify-content: right;
  }

  button:not(.toggle) {
    color: white;
    width: 3rem;
    height: 3rem;
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

const viewerToggleCss = css`
  z-index: 6;
  color: #000;
  margin: 1rem 0;

  &.collapsed {
    background-color: white;
    color: black;
  }

  @media (max-width: ${breakpoint}) {
    transform: rotate(90deg);
  }
`;

const faderOverlayCss = css`
  position: absolute;
  z-index: 4;
  background: rgba(1, 1, 1, 1);

  @media (min-width: ${afterBreakpoint}) {
    left: 3rem;
    top: 0;
    width: calc(100% - 3rem);
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: 3rem;
    width: 100%;
    height: calc(100% - 3rem);
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

  &:not(.faded) {
    pointer-events: none;
  }
`;
