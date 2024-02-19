import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import useSite from "src/store/site.store";
import useLongPress from "src/js/hooks/use-long-press";
import { afterBreakpoint, breakpoint } from "./const";

import { State } from "./Viewer";
import Spinner from "./Spinner";
import { FontAwesomeIcon, faRefreshThin, faExpandThin, faCirclePauseThin } from "./Icon";
import Toggle from "./Toggle";
import useUpdate from "src/js/hooks/use-update";
import useStateRef from "src/js/hooks/use-state-ref";

export default function ViewerControls({ api }: Props) {
  const { browserLoaded, viewOpen } = useSite(
    ({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }),
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
    onMaximize() {
      api.rootEl.style.setProperty("--viewer-min", "100%"); // 🚧 useSite
      useSite.api.toggleView(true);
    },

    dragOffset: null as null | number,
    onDragStart(e: React.PointerEvent) {
      console.log("drag start");
      state.dragOffset = useSite.api.isSmall()
        ? api.rootEl.getBoundingClientRect().y - e.clientY
        : api.rootEl.getBoundingClientRect().x - e.clientX;

      document.documentElement.classList.add(
        useSite.api.isSmall() ? "cursor-row-resize" : "cursor-col-resize"
      );
      // 🚧 use overlay instead (iframe can get in the way of body)
      document.body.addEventListener("pointermove", state.onDrag);
      document.body.addEventListener("pointerup", state.onDragEnd);
      document.body.addEventListener("pointerleave", state.onDragEnd);
      api.rootEl.style.transition = `min-width 0s, min-height 0s`;

      if (!useSite.getState().viewOpen) {
        api.rootEl.style.setProperty("--viewer-min", `${0}%`);
        useSite.api.toggleView(true);
      }
    },
    onDrag(e: PointerEvent) {
      if (state.dragOffset !== null) {
        let percent = useSite.api.isSmall()
          ? (100 * (window.innerHeight - (e.clientY + state.dragOffset))) / window.innerHeight
          : (100 * (window.innerWidth - (e.clientX + state.dragOffset))) /
            (window.innerWidth - 4 * 16);
        percent = Math.max(0, Math.min(100, percent));
        console.log(percent);

        api.rootEl.style.setProperty("--viewer-min", `${percent}%`);
      }
    },
    onDragEnd(e: PointerEvent) {
      if (state.dragOffset !== null) {
        console.log("drag end");
        state.dragOffset = null;
        document.body.removeEventListener("pointermove", state.onDrag);
        document.body.removeEventListener("pointerup", state.onDragEnd);
        document.body.removeEventListener("pointerleave", state.onDragEnd);
        api.rootEl.style.transition = "";
        document.documentElement.classList.remove("cursor-col-resize");
        document.documentElement.classList.remove("cursor-row-resize");

        const percent = parseFloat(api.rootEl.style.getPropertyValue("--viewer-min"));
        if (percent < 5) {
          api.rootEl.style.setProperty("--viewer-min", `${50}%`);
          useSite.api.toggleView(false);
        }
      }
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

      <div className={viewerDragBarCss} onPointerDown={state.onDragStart} />

      <div className={cx("viewer-buttons", buttonsCss)}>
        <button title="pause tabs" onClick={state.onPause} disabled={!api.tabs.enabled}>
          <FontAwesomeIcon icon={faCirclePauseThin} size="1x" />
        </button>
        <button title="max/min tabs" onClick={state.onMaximize}>
          <FontAwesomeIcon icon={faExpandThin} size="1x" />
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
  user-select: none;

  letter-spacing: 2px;

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

const viewerDragBarCss = css`
  background-color: #444;
  @media (min-width: ${afterBreakpoint}) {
    cursor: col-resize;
    min-width: 12px;
  }
  @media (max-width: ${breakpoint}) {
    cursor: row-resize;
    min-height: 12px;
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
    margin-left: 1rem;
    margin-right: 1rem;
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
