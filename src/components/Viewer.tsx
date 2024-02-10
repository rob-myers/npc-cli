import React from "react";
import {
  Sidebar,
  menuClasses,
} from "react-pro-sidebar";
import { css } from "@emotion/css";

import useStateRef from "../js/hooks/use-state-ref";
import useUpdate from "../js/hooks/use-update";
import Toggle from "./Toggle";

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
    <Sidebar
      // rtl
      collapsed={state.collapsed}
      backgroundColor="black"
      className={rootCss}
      collapsedWidth="4rem"
      width="50%"
    >
      <Toggle
        onToggle={state.toggleCollapsed}
        style={{
          top: "calc(0.5rem)",
          left: "calc(1rem)",
        }}
        flip="horizontal"
      />
    </Sidebar>
  );
}

const rootCss = css`
  border-color: #333333 !important;
  color: white;
  margin-left: 4rem;

  .menu .${menuClasses.button} {
    &:hover {
      background-color: #555;
    }
  }

  .menu .${menuClasses.label} {
    height: inherit;
  }

  .menu .${menuClasses.subMenuContent} {
    background-color: #222222;
  }
`;
