import { css } from "@emotion/css";
import React from "react";
import {
  Sidebar,
  Menu,
  MenuItem,
  SubMenu,
  sidebarClasses,
  menuClasses,
} from "react-pro-sidebar";

import useUpdate from "../js/hooks/use-update";
import useStateRef from "../js/hooks/use-state-ref";

import { FontAwesomeIcon, faChevronRight } from "./Icon";

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
      <div
        style={{
          position: "absolute",
          // top: "0.5rem",
          right: "calc(-1 * (2rem + 2 * 0.5rem))",
          cursor: "pointer",
          padding: "0.5rem",
          border: "1px solid #222",
          background: "#000",
        }}
        onClick={() => {
          state.collapsed = !state.collapsed;
          update();
        }}
      >
        <FontAwesomeIcon
          icon={faChevronRight}
          size="1x"
          beat={false}
          color="white"
          width="2rem"
        />
      </div>

      <Menu className="menu">
        <MenuItem>
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
  color: white;
  margin-right: 4rem;

  .${sidebarClasses.container} {
    overflow: initial;
  }

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
