import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint } from "./const";
import useStateRef from "../js/hooks/use-state-ref";
import Toggle from "./Toggle";
import { Tabs, State as TabsState } from "./tabs/Tabs";
import useSite from "src/store/site.store";

export default function Viewer() {
  const { articleKey, viewOpen, viewFull } = useSite(
    ({ articleKey, viewOpen, viewFull }) => ({
      articleKey,
      viewOpen,
      viewFull,
    }),
    shallow
  );

  const state = useStateRef(() => ({
    rootEl: {} as HTMLElement,
    tabsApi: {} as TabsState,
    onClickViewer(e: React.MouseEvent) {
      if ((e.target as HTMLElement) === state.rootEl) {
        state.toggleCollapsed();
      }
    },
    toggleCollapsed() {
      const nextViewOpen = useSite.api.toggleView();
      if (!nextViewOpen) {
        state.tabsApi.toggleEnabled(false);
      }
      if (nextViewOpen && useSite.api.isSmallViewport()) {
        useSite.api.toggleNav(false);
      }
    },
  }));

  return (
    <aside
      className={cx(viewerCss, { collapsed: !viewOpen, full: viewFull })}
      data-testid="viewer"
      onClick={state.onClickViewer}
      ref={(el) => el && (state.rootEl = el)}
    >
      <Toggle onClick={state.toggleCollapsed} flip={!viewOpen ? "horizontal" : undefined} />

      {articleKey && (
        <Tabs
          ref={(x) => x && (state.tabsApi = x)}
          id={`${articleKey}-viewer-tabs`}
          initEnabled={false}
          tabs={[
            [{ type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} }],
            [{ type: "component", class: "HelloWorld", filepath: "hello-world-2", props: {} }],
            [{ type: "component", class: "HelloWorld", filepath: "hello-world-3", props: {} }],
          ]}
          persistLayout
        />
      )}
    </aside>
  );
}

const minWidth = "4rem";

const viewerCss = css`
  position: relative;
  color: white;
  background: black;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  > button.toggle {
    position: absolute;
    z-index: 6;
    border: 2px solid #000;
    background-color: #ddd;
    color: #000;
  }
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
    transition: min-width 500ms;
    min-width: 50%;
    &.full {
      min-width: calc(100% - 2.5rem);
    }

    > button.toggle {
      top: 0.4rem;
      left: -2.3rem;
    }

    &.collapsed {
      min-width: ${minWidth};

      > button.toggle {
        left: 1rem;
        background-color: #fff;
        color: #000;
      }
      > figure.tabs {
        pointer-events: none;
        opacity: 0;
        transition: opacity 200ms;
      }
    }
  }

  @media (max-width: ${breakpoint}) {
    transition: min-height 500ms;
    min-height: 50%;
    &.full {
      min-height: calc(100% - 2.5rem);
    }

    > button.toggle {
      transform: rotate(90deg);
      top: -2.2rem;
      right: 0.5rem;

      border: 2px solid #000;
      background-color: #ddd;
      color: #000;
    }

    &.collapsed {
      min-height: 4rem;
      > button.toggle {
        top: 0.9rem;
        background-color: white;
        color: #000;
      }
    }
  }
`;
