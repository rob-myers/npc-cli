import React from "react";
import { css, cx } from "@emotion/css";

import { breakpoint } from "./const";
import useStateRef from "../js/hooks/use-state-ref";
import useUpdate from "../js/hooks/use-update";
import Toggle, { toggleClassName } from "./Toggle";
import Tabs from "./tabs/Tabs";
import useSite from "src/store/site.store";

export default function Viewer() {
  const articleKey = useSite((x) => x.articleKey);

  const state = useStateRef(() => ({
    collapsed: true,
    rootEl: /** @type {HTMLElement} */ {},
    onClickViewer(e: React.MouseEvent) {
      if ((e.target as HTMLElement) === state.rootEl) {
        state.toggleCollapsed();
      }
    },
    toggleCollapsed() {
      state.collapsed = !state.collapsed;
      update();
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
      <Toggle
        onToggle={state.toggleCollapsed}
        flip={state.collapsed ? "horizontal" : undefined}
        style={{ backgroundColor: "black" }}
      />

      {articleKey && (
        <Tabs
          id={`${articleKey}-viewer-tabs`}
          initEnabled={false}
          tabs={[
            [{ type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} }],
            [{ type: "component", class: "HelloWorld", filepath: "hello-world-2", props: {} }],
            [{ type: "component", class: "HelloWorld", filepath: "hello-world-3", props: {} }],
          ]}
          // height={[400, 500]}
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
    top: 0.5rem;
    left: 1rem;
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
    > figure.tabs {
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms;
    }
  }

  @media (max-width: ${breakpoint}) {
    transition: min-height 500ms;
    min-height: 50%;
    &.collapsed {
      min-height: 4rem;
    }
    > .${toggleClassName} {
      transform: rotate(90deg);
      left: unset;
      top: -2.2rem;
      right: 0.2rem;
    }
  }
`;
