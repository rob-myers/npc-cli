import { Link, navigate } from "gatsby";
import { css, cx } from "@emotion/css";
import React from "react";
import { Sidebar, Menu, MenuItem, SubMenu, sidebarClasses, menuClasses } from "react-pro-sidebar";

import { afterBreakpoint, breakpoint, nav, view } from "../const";
import useSite from "./site.store";
import useStateRef from "../npc-cli/hooks/use-state-ref";
import { FontAwesomeIcon, faRobot, faCode, faCircleQuestion, faCircleInfo, faChevronRight } from "./Icon";

export default function Nav() {
  const collapsed = useSite(({ navOpen }) => !navOpen);

  const state = useStateRef(() => ({
    onClickSidebar(e: React.MouseEvent) {
      console.log(e.target)
      const el = e.target as HTMLElement;
      if (
        // outside buttons
        el.classList.contains(sidebarClasses.container)
        || el.nodeName === "UL"
        // near title
        || (collapsed && el.closest(".title") !== null)
        || (!collapsed && el.classList.contains("title"))
      ) {
        state.toggleCollapsed();
        return;
      }
      const anchorEl = el.querySelectorAll("a");
      if (anchorEl.length === 1) {
        const { pathname, search, hash } = new URL(anchorEl[0].href, location.href);
        navigate(`${pathname}${search}${hash}`);
      }
    },
    toggleCollapsed() {
      useSite.api.toggleNav();
    },
  }), {
    deps: [collapsed],
  });

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
      <button onClick={(e) => { state.toggleCollapsed(); e.stopPropagation() }} className={cx("toggle", toggleCss)}>
        <FontAwesomeIcon icon={faChevronRight} size="1x" beat={false} flip={collapsed ? undefined : "horizontal"} />
      </button>

      <Menu>
        <MenuItem className="title" component="span" tabIndex={-1}>
          <Link to="/" tabIndex={-1}>NPC CLI</Link>
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

// See parent component for more CSS
const navCss = css`
  z-index: 8;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  color: white;
  border-right: 1px solid #444 !important;

  text-transform: lowercase; // 🔔

  a.${menuClasses.button}, span.${menuClasses.button} {
    &:hover {
      background-color: transparent;
      text-decoration: underline;
    }
    height: ${nav.menuItem};
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
    width: 1rem;
    min-width: 1rem;
  }

  &.${sidebarClasses.collapsed} {
    span.${menuClasses.icon} {
      margin-left: 4px;
    }
    .${menuClasses.SubMenuExpandIcon} {
      display: none;
    }
  }

  &:not(.${sidebarClasses.collapsed}) {
    span.${menuClasses.icon} {
      margin-right: 24px;
      margin-left: 12px;
    }
    .${menuClasses.SubMenuExpandIcon} {
      padding-right: 0.5rem;
    }
  }
`;

const navTitleCss = css`
  .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 500ms;
    margin-left: 0.75rem;

    .${menuClasses.button} {
      pointer-events: none; // ignore clicks outside <a>
      height: ${view.barSize};
    }
    
    .${menuClasses.label} {
      text-transform: capitalize;
      letter-spacing: 0.5rem;
      a {
        pointer-events: all;
        color: #ddd;
      }
      @media (max-width: ${breakpoint}) {
        font-weight: 500;
        font-size: 1.1rem;
      }
      @media (min-width: ${afterBreakpoint}) {
        font-weight: 200;
        font-size: 1.3rem;
      }
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

const toggleCss = css`
  position: absolute;
  z-index: 1;
  top: 0.6rem;
  right: 1rem;
  width: 1.5rem;
  height: 1.5rem;
  transition: margin-top 300ms;
  margin-top: ${nav.titleMarginTop};

  border-radius: 50%;
  background-color: white;
  color: black;
  width: 1.8rem;
  height: 1.8rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  
  transform: scale(0.8);
`;
