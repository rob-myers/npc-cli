import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import useSite from "./site.store";
import { afterBreakpoint, breakpoint, nav, view } from "../const";
import { isTouchDevice } from "src/npc-cli/service/dom";
import { getNavWidth, isSmallView } from "./layout";

import { State } from "./Viewer";
import {
  FontAwesomeIcon,
  faRefreshThin,
  faExpandThin,
  faCirclePauseThin,
  faChevronRight,
  faGrip,
  faCirclePlay,
} from "./Icon";
import useLongPress from "src/npc-cli/hooks/use-long-press";
import useUpdate from "src/npc-cli/hooks/use-update";
import useStateRef from "src/npc-cli/hooks/use-state-ref";
import { tryLocalStorageSet } from "src/npc-cli/service/generic";
import { localStorageKey } from "src/npc-cli/service/const";

export default function ViewerControls({ api }: Props) {
  const site = useSite(({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }), shallow);

  const state = useStateRef(() => ({
    onLongReset() {
      api.tabs.hardReset();
      update();
    },
    onReset: debounce(() => {
      api.tabs.reset();
      update();
    }, 300),
    toggleEnabled() {
      api.tabs.toggleEnabled();
      update();
    },
    onMaximize() {
      state.setViewerBase(100);
      useSite.api.toggleView(true);
    },
    dragOffset: null as null | number,
    onDragStart(e: React.PointerEvent) {
      // console.log("drag start");
      if (!(e.target as HTMLElement).matches(".viewer-buttons")) {
        return;
      }
      if (state.dragOffset !== null) {
        state.onDragEnd(e.nativeEvent);
        return;
      }

      state.dragOffset = isSmallView()
        ? api.rootEl.getBoundingClientRect().y - e.clientY
        : api.rootEl.getBoundingClientRect().x - e.clientX;

      document.documentElement.classList.add(
        isSmallView() ? "cursor-row-resize" : "cursor-col-resize"
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
        api.rootEl.style.setProperty("--viewer-base", `${0}%`);
        useSite.api.toggleView(true);
      }
    },
    onDrag(e: PointerEvent) {
      if (state.dragOffset !== null) {
        let percent = isSmallView()
          ? (100 * (window.innerHeight - (e.clientY + state.dragOffset))) / window.innerHeight
          : (100 * (window.innerWidth - (e.clientX + state.dragOffset))) / (window.innerWidth - getNavWidth())
        ;
        state.setViewerBase(percent);
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

        const percent = parseFloat(api.rootEl.style.getPropertyValue("--viewer-base"));
        if (percent < 10) {
          api.rootEl.style.setProperty("--viewer-base", `${50}%`);
          state.toggleCollapsed();
        }
      }
    },
    getViewerBase() {
      const percentage = api.rootEl.style.getPropertyValue("--viewer-base");
      return percentage === null ? null : parseFloat(percentage);
    },
    setViewerBase(percentage: number) {
      percentage = Math.max(0, Math.min(100, percentage));
      api.rootEl.style.setProperty("--viewer-base", `${percentage}%`);
      tryLocalStorageSet(localStorageKey.viewerBasePercentage, `${percentage}%`);
    },
    toggleCollapsed() {
      const percentage = state.getViewerBase();
      if (percentage !== null && percentage > 50) {// collapse half way
        state.setViewerBase(50);
      } else {// collapse or expand
        state.dragOffset = null;
        const willExpand = useSite.api.toggleView();
        if (!willExpand) {// will collapse
          api.tabs.toggleEnabled(false);
        }
        if (willExpand) {// will expand to last percentage (≤50)
          isSmallView() && useSite.api.toggleNav(false);
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
    <div className={cx("viewer-buttons", buttonsCss)} onPointerDown={state.onDragStart}>
      <div className="left-or-bottom-group">
        <div className="drag-indicator">
          <FontAwesomeIcon icon={faGrip} size="1x" />
        </div>
      </div>
      <button
        title={api.tabs.enabled ? "pause tabs" : "enable tabs"}
        onClick={state.toggleEnabled}
      >
        <FontAwesomeIcon icon={api.tabs.enabled ? faCirclePauseThin : faCirclePlay} size="1x" />
      </button>
      <button title="reset tabs" {...resetHandlers}>
        <FontAwesomeIcon icon={faRefreshThin} size="1x" />
      </button>
      <button title="max/min tabs" onClick={state.onMaximize}>
        <FontAwesomeIcon icon={faExpandThin} size="1x" />
      </button>
      <button onClick={() => state.toggleCollapsed()}>
        <FontAwesomeIcon
          icon={faChevronRight}
          size="1x"
          flip={!site.viewOpen ? "horizontal" : undefined}
        />
      </button>
    </div>
  );
}

interface Props {
  /** Viewer API */
  api: State;
}

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
    height: ${view.barSize};
  }

  .left-or-bottom-group {
    flex: 1;
    display: flex;
    align-items: end;
    padding: 12px 16px;
    pointer-events: none;

    .drag-indicator {
      color: #666;
    }
  }


  button {
    display: flex;
    justify-content: center;
    align-items: center;

    @media (min-width: ${afterBreakpoint}) {
      width: var(--view-bar-size);
      height: ${nav.menuItem};
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

  button:last-child {
    @media (min-width: ${afterBreakpoint}) {
      height: ${view.barSize};
      height: 4rem;
    }
    @media (max-width: ${breakpoint}) {
      transform: rotate(90deg);
      margin-right: 0.5rem;
    }
  }
`;
