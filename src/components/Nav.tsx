import { Link } from "gatsby";
import { css } from "@emotion/css";
import React from "react";
import { Sidebar, Menu, MenuItem, SubMenu, sidebarClasses, menuClasses } from "react-pro-sidebar";

import { nav } from "src/js/service/const";
import useStateRef from "../js/hooks/use-state-ref";
import Toggle from "./Toggle";
import { FontAwesomeIcon, faRobot, faCode, faCircleQuestion, faCircleInfo } from "./Icon";
import useSite from "src/store/site.store";
import npcCliTitlePng from "../../static/assets/npc-cli-title.png";

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
      collapsedWidth={nav.collapsedWidth}
      data-testid="nav"
      onClick={state.onClickSidebar}
      width={nav.expandedWidth}
    >
      <Toggle onClick={state.toggleCollapsed} flip={collapsed ? undefined : "horizontal"} />

      <Menu>
        <MenuItem className="title" tabIndex={-1} component="span">
          <Link to="/">
            <img src={npcCliTitlePng} />
          </Link>
        </MenuItem>
        <SubMenu icon={icon.blog} label="Blog">
          <MenuItem component="span">
            <Link to="/intro">Intro</Link>
          </MenuItem>
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <SubMenu icon={icon.dev} label="Dev">
          <MenuItem>Tech</MenuItem>
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <MenuItem icon={icon.help}>Help</MenuItem>
        <MenuItem icon={icon.about}>About</MenuItem>
      </Menu>
    </Sidebar>
  );
}

const navCss = css`
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  color: white;
  border-right: 1px solid #444 !important;

  .${sidebarClasses.container} button.toggle {
    position: absolute;
    z-index: 1;
    top: calc(0.5 * (5rem - 1.8rem));
    right: 1rem;
  }

  .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 500ms;

    .${menuClasses.button} {
      height: 5rem;
    }

    .${menuClasses.label} {
      height: 1.6rem;
      img {
        height: 100%;
        filter: invert();
      }
    }
  }
  &.${sidebarClasses.collapsed} .${menuClasses.menuItemRoot}.title {
    opacity: 0;
  }

  a.${menuClasses.button}, span.${menuClasses.button} {
    &:hover {
      background-color: transparent;
      text-decoration: underline;
    }
    height: 3.5rem;
  }

  .${menuClasses.subMenuContent} {
    background-color: #222222;
  }

  span.${menuClasses.label} a {
    color: white;
    text-decoration: none;
  }

  span.${menuClasses.icon} {
    transform: scale(1.4);
    width: 1.5rem;
    min-width: 1.5rem;
    margin-right: 24px;
  }

  &.${sidebarClasses.collapsed} .${menuClasses.SubMenuExpandIcon} {
    display: none;
  }
  &:not(.${sidebarClasses.collapsed}) .${menuClasses.SubMenuExpandIcon} {
    padding-right: 0.5rem;
  }
`;

const icon = {
  blog: <FontAwesomeIcon icon={faRobot} color="white" size="1x" />,
  dev: <FontAwesomeIcon icon={faCode} color="white" size="1x" />,
  help: <FontAwesomeIcon icon={faCircleQuestion} color="white" size="1x" />,
  about: <FontAwesomeIcon icon={faCircleInfo} color="white" size="1x" />,
};
