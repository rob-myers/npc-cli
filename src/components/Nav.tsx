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

import npcCliTitle from "../../static/assets/npc-cli-title.png";
import Toggle from "./Toggle";

export default function Nav() {
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
      backgroundColor="black"
      className={rootCss}
      collapsed={state.collapsed}
      collapsedWidth="4rem"
      onClick={(e) => console.log(e.target)}
    >
      <Toggle
        onToggle={state.toggleCollapsed}
        style={{
          top: "calc(0.5rem)",
          right: "calc(1rem)",
        }}
      />

      <Menu className="menu">
        <MenuItem className="title" tabIndex={-1}>
          <img src={npcCliTitle} />
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

  .menu .${menuClasses.button} {
    &:hover {
      background-color: transparent;
      text-decoration: underline;
    }
    height: 3rem;
  }

  .menu .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 500ms;

    .ps-menu-label {
      height: 1.4rem;
      img {
        height: 100%;
        filter: invert();
      }
    }
  }

  &.ps-collapsed .menu .${menuClasses.menuItemRoot}.title {
    opacity: 0;
  }

  .menu .${menuClasses.subMenuContent} {
    background-color: #222222;
  }
`;
