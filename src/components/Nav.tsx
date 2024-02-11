import { css, cx } from "@emotion/css";
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
      className={cx("nav", navCss)}
      collapsed={state.collapsed}
      collapsedWidth="4rem"
      width="16rem"
    >
      <Toggle
        onToggle={state.toggleCollapsed}
        style={{
          top: "calc(1rem)",
          right: "calc(1rem)",
        }}
        flip={state.collapsed ? undefined : 'horizontal'}
      />

      <Menu>
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

const navCss = css`
  color: white;
  border: none !important;

  a.${menuClasses.button} {
    &:hover {
      background-color: transparent;
      text-decoration: underline;
    }
    height: 3rem;
  }

  .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 500ms;

    .${menuClasses.button} {
      height: 4rem;
    }

    .${menuClasses.label} {
      height: 1.4rem;
      img {
        height: 100%;
        filter: invert();
      }
    }
  }

  &.${sidebarClasses.collapsed} .${menuClasses.menuItemRoot}.title {
    opacity: 0;
  }

  .${menuClasses.subMenuContent} {
    background-color: #222222;
  }
`;
