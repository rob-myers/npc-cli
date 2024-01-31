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
import Icon from "./Icon";

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
        <MenuItem>
          <div
            onClick={() => {
              state.collapsed = !state.collapsed;
              update();
            }}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Icon name="double_arrow" size={2} bg="#000" rtl />
          </div>
        </MenuItem>
      </Menu>
      <div style={{ direction: "ltr" }}></div>
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
