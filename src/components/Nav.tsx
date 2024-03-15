import { Link, navigate } from "gatsby";
import { css, cx } from "@emotion/css";
import React from "react";
import { Sidebar, Menu, MenuItem, SubMenu, sidebarClasses, menuClasses } from "react-pro-sidebar";

import { nav, view } from "../const";
import useSite from "./site.store";
import useStateRef from "../npc-cli/hooks/use-state-ref";
import Toggle from "./Toggle";
import { FontAwesomeIcon, faRobot, faCode, faCircleQuestion, faCircleInfo } from "./Icon";

export default function Nav() {
  const collapsed = useSite(({ navOpen }) => !navOpen);

  const state = useStateRef(() => ({
    onClickSidebar(e: React.MouseEvent) {
      const el = e.target as HTMLElement;
      if (el.classList.contains(sidebarClasses.container)) {
        state.toggleCollapsed(); // outside buttons
        return;
      }
      const anchorEl = el.querySelectorAll("a");
      if (anchorEl.length === 1) {
        navigate(anchorEl[0].href);
      }
    },
    toggleCollapsed() {
      useSite.api.toggleNav();
    },
  }));

  return (
    <Sidebar
      backgroundColor="black"
      className={cx(navCss, navTitleCss)}
      collapsed={collapsed}
      collapsedWidth={nav.collapsedWidth}
      data-testid="nav"
      onClick={state.onClickSidebar}
      width={nav.expandedWidth}
    >
      <Toggle onClick={state.toggleCollapsed} flip={collapsed ? undefined : "horizontal"} />

      <Menu>
        <MenuItem className="title" tabIndex={-1} component="span">
          <Link to="/">NPC CLI</Link>
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
    top: calc(0.5 * (${view.barSize} - 1.5rem));
    right: calc(0.5 * (${view.barSize} - 1.5rem));
    width: 1.5rem;
    height: 1.5rem;
    transition: margin-top 300ms;
    margin-top: ${nav.titleMarginTop};
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
    padding-left: 20px;
  }

  span.${menuClasses.label} a {
    color: white;
    text-decoration: none;
  }

  span.${menuClasses.icon} {
    transform: scale(1);
    width: 1rem;
    min-width: 1rem;
    margin-right: 24px;
    margin-left: 12px;
  }

  &.${sidebarClasses.collapsed} .${menuClasses.SubMenuExpandIcon} {
    display: none;
  }
  &:not(.${sidebarClasses.collapsed}) .${menuClasses.SubMenuExpandIcon} {
    padding-right: 0.5rem;
  }
`;

const navTitleCss = css`
  .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 500ms;
    margin-top: ${nav.titleMarginTop};
    margin-left: 12px;

    .${menuClasses.button} {
      height: calc(1 * ${view.barSize});
    }

    .${menuClasses.label} {
      display: flex;
      align-items: center;

      font-size: 1.5rem;
      letter-spacing: 0.4rem;
      filter: drop-shadow(3px 0 #336);
    }
  }

  &.${sidebarClasses.collapsed} .${menuClasses.menuItemRoot}.title {
    opacity: 0;
  }
`;

const icon = {
  blog: <FontAwesomeIcon icon={faRobot} color="white" size="1x" />,
  dev: <FontAwesomeIcon icon={faCode} color="white" size="1x" />,
  help: <FontAwesomeIcon icon={faCircleQuestion} color="white" size="1x" />,
  about: <FontAwesomeIcon icon={faCircleInfo} color="white" size="1x" />,
};
