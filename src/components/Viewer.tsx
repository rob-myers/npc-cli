import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint } from "./const";
import useStateRef from "../js/hooks/use-state-ref";
import useSite from "src/store/site.store";

import { Tabs, State as TabsState } from "./tabs/Tabs";
import ViewerControls from "./ViewerControls";

export default function Viewer() {
  const { browserLoaded, viewOpen } = useSite(
    ({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }),
    shallow
  );

  const state = useStateRef(
    (): State => ({
      rootEl: {} as HTMLElement,
      tabs: {} as TabsState,
      // 🚧 move into ViewerControls
      toggleCollapsed() {
        const nextViewOpen = useSite.api.toggleView();
        if (!nextViewOpen) {
          state.tabs.toggleEnabled(false);
        }
        if (nextViewOpen && useSite.api.isSmall()) {
          useSite.api.toggleNav(false);
        }
      },
    })
  );

  return (
    <aside
      className={cx(viewerCss, { collapsed: !viewOpen })}
      data-testid="viewer"
      ref={(el) => el && (state.rootEl = el)}
      style={
        browserLoaded && !viewOpen
          ? useSite.api.isSmall()
            ? { minHeight: "0%" }
            : { minWidth: "0%" }
          : undefined
      }
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
  toggleCollapsed(): void;
}

const viewerCss = css`
  position: relative;
  color: white;
  background: black;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

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

  display: flex;

  --viewer-min: 50%;
  &.collapsed {
    --viewer-min: 0%;
  }

  @media (min-width: ${afterBreakpoint}) {
    flex-direction: row;
    transition: min-width 500ms;
    min-width: var(--viewer-min);
  }

  @media (max-width: ${breakpoint}) {
    flex-direction: column;
    transition: min-height 500ms;
    min-height: var(--viewer-min);
  }
`;
