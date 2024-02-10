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
import npcCliTitle from "../../static/assets/npc-cli-title.png";

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
      <div
        className="expand-button"
        onClick={state.toggleCollapsed}
        onKeyDown={(e) =>
          ["Enter", " "].includes(e.key) && state.toggleCollapsed()
        }
        tabIndex={0}
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

  .expand-button {
    position: absolute;

    z-index: 1;
    border-radius: 50%;
    background-color: #444;
    width: 2rem;
    height: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    top: calc(0.5rem - 0 * 4px);
    right: calc(-1 * (-0.75rem));
    cursor: pointer;
  }

  /* .${sidebarClasses.container} {
    overflow: initial;
  } */

  .menu .${menuClasses.button} {
    &:hover {
      background-color: transparent;
      text-decoration: underline;
    }
    height: 3rem;
  }

  .menu .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 300ms;
    
    .ps-menu-label {
      height: 1.4rem;
      img {
        height: 100%;
        filter: invert();
      }
    }
  }

  &.ps-collapsed .${menuClasses.menuItemRoot}.title {
    opacity: 0;
  }

  .menu .${menuClasses.subMenuContent} {
    background-color: #222222;
  }
`;
