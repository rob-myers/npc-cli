import React from "react";
import {
  Sidebar,
  Menu,
  MenuItem,
  SubMenu,
  menuClasses,
} from "react-pro-sidebar";
import { css } from "@emotion/css";

import useStateRef from "../js/hooks/use-state-ref";
import useUpdate from "../js/hooks/use-update";

export default function Viewer() {
  const update = useUpdate();
  const state = useStateRef(() => ({
    collapsed: true,
  }));

  return (
    <Sidebar
      // rtl
      collapsed={state.collapsed}
      backgroundColor="black"
      className={rootCss}
      width="50%"
    >
      <Menu className="menu">
        <MenuItem
          onClick={() => {
            state.collapsed = !state.collapsed;
            update();
          }}
        >
          <div className="toggle">&lt;</div>
        </MenuItem>
      </Menu>
      <div style={{ direction: "ltr" }}></div>
    </Sidebar>
  );
}

const rootCss = css`
  border-color: #333333 !important;
  color: white;

  .menu .${menuClasses.button} {
    &:hover {
      background-color: #555;
    }
  }

  .menu .${menuClasses.subMenuContent} {
    background-color: #222222;
  }

  .menu .toggle {
    display: flex;
    justify-content: center;
  }
`;
