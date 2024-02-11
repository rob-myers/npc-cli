import React from "react";
import { css, cx } from "@emotion/css";

import useStateRef from "../js/hooks/use-state-ref";
import useUpdate from "../js/hooks/use-update";
import Toggle, { toggleClassName } from "./Toggle";
import { breakpoint } from "./const";

export default function Viewer() {
  const update = useUpdate();
  const state = useStateRef(() => ({
    collapsed: true,
    toggleCollapsed() {
      state.collapsed = !state.collapsed;
      update();
    },
  }));

  return (
    <aside className={cx("viewer", viewerCss, { collapsed: state.collapsed })}>
      <Toggle
        onToggle={state.toggleCollapsed}
        flip={state.collapsed ? "horizontal" : undefined}
      />
    </aside>
  );
}

const viewerCss = css`
  position: relative;
  color: white;
  background: black;

  > .${toggleClassName} {
    top: calc(0.5rem);
    left: calc(1rem);
  }

  transition: min-width 500ms;
  min-width: 50%;
  &.collapsed {
    min-width: 4rem;
  }

  @media(max-width: ${breakpoint}) {
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
