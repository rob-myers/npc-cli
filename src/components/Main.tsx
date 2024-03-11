import React from "react";
import { css, cx } from "@emotion/css";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint } from "../const";
import useSite from "./site.store";
import { isSmallView } from "./layout";

export default function Main(props: React.PropsWithChildren) {
  const site = useSite(({ navOpen, mainOverlay }) => ({ navOpen, mainOverlay }), shallow);

  const overlayOpen = site.mainOverlay || (site.navOpen && isSmallView());

  return (
    <section className={mainCss} data-testid="main">
      <div className={cx(overlayCss, { overlayOpen })} onClick={() => useSite.api.toggleNav()} />

      <header className={cx(mainTitleCss, { overlayOpen })} data-testid="main-title">
        NPC CLI
      </header>

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
    > a {
      max-width: 1024px;
    }
    > main {
      max-width: 1024px;
      padding: 0 4rem;
    }
  }
  @media (max-width: ${breakpoint}) {
    padding: 0 2rem; // 🚧
    overflow: scroll;
    width: initial;
  }
`;

const mainTitleCss = css`
  margin: 2rem auto;
  letter-spacing: 1rem;
  font-size: 4rem;

  transition: filter 300ms;

  &.overlayOpen {
    filter: none;
  }

  @media (min-width: ${afterBreakpoint}) {
    max-width: 1024px;
    padding: 0 4rem;
    filter: drop-shadow(8px 0px #ddd);
  }
  @media (max-width: ${breakpoint}) {
    // 🔔 Too wide causes extra body height on mobile
    max-width: 100%;
    filter: drop-shadow(4px 0px #ddd);
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
