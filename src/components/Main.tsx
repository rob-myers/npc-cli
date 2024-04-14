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

      <header className={mainHeaderCss} data-testid="main-title">
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

const mainHeaderCss = css`
  display: flex;
  justify-content: right;
  align-items: center;
  height: 4rem;
  margin-bottom: 2rem;

  color: #444;
  border-bottom: 1px solid #aaa;
  
  font-size: 1.2rem;
  letter-spacing: 1.5rem;

  @media (min-width: ${afterBreakpoint}) {
    justify-content: left;
  }
  @media (max-width: ${breakpoint}) {
    justify-content: right;
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
