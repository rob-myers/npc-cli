import React from "react";
import { css, cx } from "@emotion/css";

import { breakpoint } from "./const";
import useStateRef from "../js/hooks/use-state-ref";
import useUpdate from "../js/hooks/use-update";
import Toggle, { toggleClassName } from "./Toggle";
import { Tabs, State as TabsState } from "./tabs/Tabs";
import useSite from "src/store/site.store";

export default function Viewer() {
  const articleKey = useSite((x) => x.articleKey);

  const state = useStateRef(() => ({
    collapsed: true,
    rootEl: {} as HTMLElement,
    tabsApi: {} as TabsState,
    onClickViewer(e: React.MouseEvent) {
      if ((e.target as HTMLElement) === state.rootEl) {
        state.toggleCollapsed();
      }
    },
    toggleCollapsed() {
      state.collapsed = !state.collapsed;
      update();
      if (state.collapsed) {
        state.tabsApi.toggleEnabled(false);
      }
      if (!state.collapsed && useSite.api.isSmallViewport()) {
        useSite.api.toggleNav(false);
      }
    },
  }));

  const update = useUpdate();

  return (
    <aside
      className={cx(viewerCss, { collapsed: state.collapsed })}
      data-testid="viewer"
      onClick={state.onClickViewer}
      ref={(el) => el && (state.rootEl = el)}
    >
      <Toggle onClick={state.toggleCollapsed} flip={state.collapsed ? "horizontal" : undefined} />

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

  > .${toggleClassName} {
    position: absolute;
    z-index: 6;
    top: 0.4rem;
    left: -2.3rem;

    border: 2px solid #000;
    background-color: #ddd;
    color: #000;
  }

  > figure.tabs {
    cursor: auto;
    opacity: 1;
    transition: opacity 200ms 100ms; // delay 100ms
  }

  transition: min-width 500ms;
  min-width: 50%;
  &.collapsed {
    min-width: ${minWidth};

    > .${toggleClassName} {
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

  @media (max-width: ${breakpoint}) {
    transition: min-height 500ms;
    min-height: 50%;

    > .${toggleClassName} {
      transform: rotate(90deg);
      left: unset;
      top: -2.2rem;
      right: 0.5rem;

      border: 2px solid #000;
      background-color: #ddd;
      color: #000;
    }

    &.collapsed {
      min-height: 4rem;
      > .${toggleClassName} {
        top: 0.9rem;
        left: unset;
        background-color: white;
        color: #000;
      }
    }
  }
`;
