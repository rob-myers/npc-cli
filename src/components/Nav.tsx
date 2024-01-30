import { css } from "@emotion/css";
import React from "react";
import {
  Sidebar,
  Menu,
  MenuItem,
  SubMenu,
  menuClasses,
} from "react-pro-sidebar";

import useUpdate from "../js/hooks/use-update";
import useStateRef from "../js/hooks/use-state-ref";

export default function Nav() {
  const update = useUpdate();
  const state = useStateRef(() => ({
    collapsed: true,
  }));

  return (
    <Sidebar
      backgroundColor="black"
      className={rootCss}
      collapsed={state.collapsed}
      onClick={(e) => console.log(e.target)}
    >
      <Menu className="menu">
        <MenuItem
          onClick={() => {
            state.collapsed = !state.collapsed;
            update();
          }}
        >
          <h3>NPC CLI</h3>
        </MenuItem>
        <SubMenu label="Go">
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <MenuItem> Documentation </MenuItem>
        <MenuItem> Calendar </MenuItem>
      </Menu>
    </Sidebar>
  );
}

const rootCss = css`
  /* border-color: #333333 !important; */
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
