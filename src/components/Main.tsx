import { Link } from "gatsby";
import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint } from "./const";
import npcCliTitlePng from "../../static/assets/npc-cli-title.png";
import useSite from "src/store/site.store";

export default function Main(props: React.PropsWithChildren) {
  const site = useSite(({ navOpen, mainOverlay }) => ({ navOpen, mainOverlay }), shallow);

  const overlayOpen = site.mainOverlay || (site.navOpen && useSite.api.isSmall());

  return (
    <section className={mainCss} data-testid="main">
      <div className={cx(overlayCss, { overlayOpen })} onClick={() => useSite.api.toggleNav()} />

      <Link to="/">
        <div className={mainTitleCss} data-testid="main-title">
          <img src={npcCliTitlePng} />
        </div>
      </Link>

      <main>{props.children}</main>
    </section>
  );
}

const mainCss = css`
  width: 100%;
  > main {
    margin: 0 auto;
  }

  @media (min-width: ${afterBreakpoint}) {
    white-space: nowrap;
    overflow-x: scroll;
    > main {
      max-width: 1024px;
      padding: 0 4rem;
    }
  }
  @media (max-width: ${breakpoint}) {
    padding: 0 2rem;
    overflow: scroll;
    width: initial;
  }
`;

const mainTitleCss = css`
  max-width: 1024px;
  margin: 2rem auto;
  img {
    width: 300px;
  }

  @media (min-width: ${afterBreakpoint}) {
    padding: 0 4rem;
  }
  @media (max-width: ${breakpoint}) {
    img {
      // 🔔 Too wide causes extra body height on mobile
      max-width: 100%;
    }
  }
`;

const overlayCss = css`
  position: absolute;
  background-color: rgba(0, 0, 0, 0.5);
  left: 0;
  top: 0;
  width: 100%;
  height: 100dvh;
  z-index: 0;

  pointer-events: none;
  transition: opacity 300ms;
  opacity: 0;

  &.overlayOpen {
    cursor: pointer;
    pointer-events: all;
    opacity: 1;
  }
`;
