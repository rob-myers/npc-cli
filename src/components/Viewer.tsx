import React from "react";
import { css, cx } from "@emotion/css";

import { breakpoint } from "./const";
import useStateRef from "../js/hooks/use-state-ref";
import useUpdate from "../js/hooks/use-update";
import Toggle, { toggleClassName } from "./Toggle";
import Tabs from "./tabs/Tabs";

export default function Viewer() {
  const update = useUpdate();

  const state = useStateRef(() => ({
    collapsed: true,
    onClickViewer(e: React.MouseEvent) {
      const el = e.target as HTMLElement;
      if (el.classList.contains("viewer")) {
        state.toggleCollapsed();
      }
    },
    toggleCollapsed() {
      state.collapsed = !state.collapsed;
      update();
    },
  }));

  return (
    <aside
      className={cx("viewer", "no-blue-flash", viewerCss, { collapsed: state.collapsed })}
      onClick={state.onClickViewer}
    >
      <Toggle onToggle={state.toggleCollapsed} flip={state.collapsed ? "horizontal" : undefined} />
      {/* 🚧 */}
      <Tabs
        id="viewer-tabs" // 🚧 {page}-viewer-tabs
        initEnabled={false}
        tabs={[
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} }],
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-2", props: {} }],
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-3", props: {} }],
          [{ type: "component", class: "HelloWorld", filepath: "hello-world-4", props: {} }],
        ]}
        // height={[400, 500]}
        persistLayout
      />
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
    z-index: 1;
    top: calc(0.5rem);
    left: calc(1rem);
  }

  transition: min-width 500ms;
  min-width: 50%;

  .tabs {
    opacity: 1;
    transition: opacity 200ms 100ms; // delay 100ms
  }

  &.collapsed {
    min-width: ${minWidth};
    .tabs {
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
      right: calc(1rem);
    }
  }
`;
