import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint } from "./const";
import useStateRef from "../js/hooks/use-state-ref";
import useSite from "src/store/site.store";

import { Tabs, State as TabsState } from "./tabs/Tabs";
import ViewerControls from "./ViewerControls";

export default function Viewer() {
  const { viewOpen, viewFull } = useSite(
    ({ viewOpen, viewFull }) => ({
      viewOpen,
      viewFull,
    }),
    shallow
  );

  const state = useStateRef(
    (): State => ({
      rootEl: {} as HTMLElement,
      tabs: {} as TabsState,
      onClickViewer(e: React.MouseEvent) {
        const el = e.target as HTMLElement;
        if (!el.closest("button") && !el.closest("figure.tabs")) {
          state.toggleCollapsed();
        }
      },
      toggleCollapsed() {
        const nextViewOpen = useSite.api.toggleView();
        if (!nextViewOpen) {
          state.tabs.toggleEnabled(false);
        }
        if (nextViewOpen && useSite.api.isSmallViewport()) {
          useSite.api.toggleNav(false);
        }
      },
    })
  );

  return (
    <aside
      className={cx(viewerCss, { collapsed: !viewOpen, full: viewFull })}
      data-testid="viewer"
      onClick={state.onClickViewer}
      ref={(el) => el && (state.rootEl = el)}
    >
      <ViewerControls api={state} />
      <Tabs
        ref={(x) => x && (state.tabs = x)}
        id="viewer-tabs"
        initEnabled={false}
        tabs={[
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} }],
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-2", props: {} }],
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-3", props: {} }],
        ]}
        persistLayout
      />
    </aside>
  );
}

export interface State {
  rootEl: HTMLElement;
  /** Tabs API */
  tabs: TabsState;
  onClickViewer(e: React.MouseEvent): void;
  toggleCollapsed(): void;
}

const minWidth = "3rem";

const viewerCss = css`
  position: relative;
  color: white;
  background: black;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  display: flex;

  &:not(.collapsed) > figure.tabs {
    cursor: auto;
    opacity: 1;
    transition: opacity 200ms 100ms; // delay 100ms
  }
  &.collapsed > figure.tabs {
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms;
  }

  @media (min-width: ${afterBreakpoint}) {
    flex-direction: row;
    transition: min-width 500ms;
    min-width: 50%;
    &.full {
      min-width: 100%;
    }
    &.collapsed {
      min-width: ${minWidth};
    }
  }

  @media (max-width: ${breakpoint}) {
    flex-direction: column;
    transition: min-height 500ms;
    min-height: 50%;
    &.full {
      min-height: 100%;
    }
    &.collapsed {
      min-height: 3rem;
    }
  }
`;
