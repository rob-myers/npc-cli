import { Link } from "gatsby";
import { css } from "@emotion/css";
import React from "react";
import { Sidebar, Menu, MenuItem, SubMenu, sidebarClasses, menuClasses } from "react-pro-sidebar";

import npcCliTitlePng from "../../static/assets/npc-cli-title.png";
import useStateRef from "../js/hooks/use-state-ref";
import Toggle from "./Toggle";
import useSite from "src/store/site.store";

export default function Nav() {
  const collapsed = useSite(({ navOpen }) => !navOpen);

  const state = useStateRef(() => ({
    onClickSidebar(e: React.MouseEvent) {
      const el = e.target as HTMLElement;
      if (el.classList.contains(sidebarClasses.container)) {
        state.toggleCollapsed(); // outside buttons
      } else if (
        el.classList.contains(menuClasses.button) &&
        el.parentElement?.previousSibling === null
      ) {
        state.toggleCollapsed(); // top-most button
      }
    },
    toggleCollapsed() {
      useSite.api.toggleNav();
    },
  }));

  return (
    <Sidebar
      backgroundColor="black"
      className={navCss}
      collapsed={collapsed}
      collapsedWidth="4rem"
      data-testid="nav"
      onClick={state.onClickSidebar}
      width="14rem"
    >
      <Toggle onClick={state.toggleCollapsed} flip={collapsed ? undefined : "horizontal"} />

      <Menu>
        <MenuItem className="title" tabIndex={-1} component="span">
          <Link to="/">
            <img src={npcCliTitlePng} />
          </Link>
        </MenuItem>
        <SubMenu label="Blog">
          <MenuItem component="span">
            <Link to="/intro">Intro</Link>
          </MenuItem>
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <SubMenu label="Dev">
          <MenuItem>Tech</MenuItem>
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <MenuItem>Help</MenuItem>
        <MenuItem>About</MenuItem>
      </Menu>
    </Sidebar>
  );
}

const navCss = css`
  color: white;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  border-right: 1px solid #444 !important;

  a.${menuClasses.button}, span.${menuClasses.button} {
    &:hover {
      background-color: transparent;
      text-decoration: underline;
    }
    height: 3rem;
  }
  span.${menuClasses.label} a {
    color: white;
    text-decoration: none;
  }

  .${sidebarClasses.container} button.toggle {
    position: absolute;
    z-index: 1;
    top: 1rem;
    right: 1rem;
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

  &:not(.${sidebarClasses.collapsed}) .${menuClasses.SubMenuExpandIcon} {
    padding-right: 0.5rem;
  }
  .${menuClasses.subMenuContent} {
    background-color: #222222;
  }
`;
