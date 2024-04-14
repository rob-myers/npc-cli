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
    <section
      className={cx(mainCss, "prose max-w-screen-lg")}
      data-testid="main"
    >
      <div
        className={cx(overlayCss, { overlayOpen })}
        onClick={() => useSite.api.toggleNav()}
      />

      <header className={mainTitleCss} data-testid="main-title">
        NPC CLI
      </header>

      <main>
        {props.children}
      </main>
    </section>
  );
}

const mainCss = css`
  @media (min-width: ${afterBreakpoint}) {
    white-space: nowrap;
    overflow-x: scroll;
    margin: 0 auto;
    padding: 0 32px;
  }
  @media (max-width: ${breakpoint}) {
    overflow: scroll;
    padding: 0 12px;
  }
`;

const mainTitleCss = css`
  margin: 1.5rem auto 1.5rem auto;
  color: #444;
  /* font-weight: 500; */

  @media (min-width: ${afterBreakpoint}) {
    font-size: 4rem;
    letter-spacing: 1.5rem;
  }
  @media (max-width: ${breakpoint}) {
    font-size: 4rem;
    letter-spacing: 1.5rem;
  }
`;

const overlayCss = css`
  -webkit-tap-highlight-color: transparent;
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
