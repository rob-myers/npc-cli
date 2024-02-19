import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import useSite from "src/store/site.store";
import { isTouchDevice } from "src/js/service/dom";
import { afterBreakpoint, breakpoint } from "./const";

import { State } from "./Viewer";
import Spinner from "./Spinner";
import { FontAwesomeIcon, faRefreshThin, faExpandThin, faCirclePauseThin } from "./Icon";
import Toggle from "./Toggle";
import useLongPress from "src/js/hooks/use-long-press";
import useUpdate from "src/js/hooks/use-update";
import useStateRef from "src/js/hooks/use-state-ref";
import { view } from "src/js/service/const";

export default function ViewerControls({ api }: Props) {
  const site = useSite(({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }), shallow);

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
      api.rootEl.style.setProperty("--viewer-min", "100%");
      useSite.api.toggleView(true);
    },

    dragOffset: null as null | number,
    onDragStart(e: React.PointerEvent) {
      // console.log("drag start");
      if (!(e.target as HTMLElement).matches(".viewer-buttons")) {
        return;
      }

      state.dragOffset = useSite.api.isSmall()
        ? api.rootEl.getBoundingClientRect().y - e.clientY
        : api.rootEl.getBoundingClientRect().x - e.clientX;

      document.documentElement.classList.add(
        useSite.api.isSmall() ? "cursor-row-resize" : "cursor-col-resize"
      );
      // trigger main overlay (iframe can get in the way of body)
      useSite.setState({ mainOverlay: true });
      document.body.addEventListener("pointermove", state.onDrag);
      document.body.addEventListener("pointerup", state.onDragEnd);
      if (!isTouchDevice()) {
        document.body.addEventListener("pointerleave", state.onDragEnd);
      }
      api.rootEl.style.transition = `min-width 0s, min-height 0s`;

      if (useSite.api.isViewClosed()) {
        api.rootEl.style.setProperty("--viewer-min", `${0}%`);
        useSite.api.toggleView(true);
      }
    },
    onDrag(e: PointerEvent) {
      if (state.dragOffset !== null) {
        let percent = useSite.api.isSmall()
          ? (100 * (window.innerHeight - (e.clientY + state.dragOffset))) / window.innerHeight
          : (100 * (window.innerWidth - (e.clientX + state.dragOffset))) /
            (window.innerWidth - useSite.api.getNavWidth());
        percent = Math.max(0, Math.min(100, percent));
        api.rootEl.style.setProperty("--viewer-min", `${percent}%`);
        // console.log(percent);
      }
    },
    onDragEnd(_e: PointerEvent) {
      if (state.dragOffset !== null) {
        // console.log("drag end");
        state.dragOffset = null;
        document.documentElement.classList.remove("cursor-col-resize");
        document.documentElement.classList.remove("cursor-row-resize");
        useSite.setState({ mainOverlay: false });
        document.body.removeEventListener("pointermove", state.onDrag);
        document.body.removeEventListener("pointerup", state.onDragEnd);
        document.body.removeEventListener("pointerleave", state.onDragEnd);
        api.rootEl.style.transition = "";

        const percent = parseFloat(api.rootEl.style.getPropertyValue("--viewer-min"));
        if (percent < 5) {
          api.rootEl.style.setProperty("--viewer-min", `${50}%`);
          state.toggleCollapsed(false);
        }
      }
    },

    toggleCollapsed(next?: boolean) {
      const willOpen = useSite.api.toggleView(next);
      if (!willOpen) {
        api.tabs.toggleEnabled(false);
      }
      if (willOpen && useSite.api.isSmall()) {
        useSite.api.toggleNav(false);
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
        className={cx(interactOverlayCss, { enabled: api.tabs.enabled, collapsed: !site.viewOpen })}
      >
        {site.browserLoaded ? "interact" : <Spinner size={24} />}
      </button>

      <div className={cx("viewer-buttons", buttonsCss)} onPointerDown={state.onDragStart}>
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
          onClick={() => state.toggleCollapsed()}
          className={cx(viewerToggleCss, { collapsed: !site.viewOpen })}
          flip={!site.viewOpen ? "horizontal" : undefined}
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
    left: var(--view-bar-size);
    top: 0;
    width: calc(100% - var(--view-bar-size));
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: var(--view-bar-size);
    width: 100%;
    height: calc(100% - var(--view-bar-size));
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
  z-index: 5;
  display: flex;
  justify-content: right;
  align-items: center;
  background-color: #000;
  touch-action: none;

  @media (min-width: ${afterBreakpoint}) {
    cursor: col-resize;
    flex-direction: column-reverse;
    width: var(--view-bar-size);
    height: 100%;
    border-right: 1px solid #444;
  }

  @media (max-width: ${breakpoint}) {
    cursor: row-resize;
    flex-direction: row;
    border-bottom: 1px solid #444;
  }

  button:not(.toggle) {
    display: flex;
    justify-content: center;
    align-items: center;

    @media (min-width: ${afterBreakpoint}) {
      width: var(--view-bar-size);
      height: var(--view-icon-size);
    }
    @media (max-width: ${breakpoint}) {
      width: var(--view-icon-size);
      height: var(--view-bar-size);
    }

    color: white;
    cursor: pointer;
    &:disabled {
      cursor: auto;
      color: #888;
    }
  }
`;

const viewerToggleCss = css`
  z-index: 6;
  color: #000;

  &.collapsed {
    background-color: white;
    color: black;
  }

  @media (min-width: ${afterBreakpoint}) {
    margin: calc(0.5 * (5rem - 1.8rem)) 0;
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
    left: var(--view-bar-size);
    top: 0;
    width: calc(100% + (-1 * var(--view-bar-size)));
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: var(--view-bar-size);
    width: 100%;
    height: calc(100% + (-1 * var(--view-bar-size)));
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
