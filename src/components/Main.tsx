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
      className={cx(mainCss, "prose max-w-screen-lg prose-headings:font-light")}
      data-testid="main"
    >
      <header className={mainHeaderCss} data-testid="main-title">
        NPC CLI
      </header>

      <main>
        {props.children}
      </main>

      <div
        className={cx(overlayCss, { overlayOpen })}
        onClick={() => useSite.api.toggleNav()}
      />
    </section>
  );
}

const mainCss = css`
  > header, > main {
    background-color: #fff;
  }
  > main {
    padding-top: 2rem;
  }

  @media (max-width: ${breakpoint}) {
    overflow: scroll;
    padding: 0 12px;
  }
  @media (min-width: ${afterBreakpoint}) {
    width: 100%;
    margin: 0 auto;
    > header, > main {
      margin-left: 1rem;
      margin-right: 1rem;
      padding-left: 2rem;
      padding-right: 2rem;
    }
    > header {
      margin-top: 0rem;
      min-width: calc(400px + 2 * 2rem);
    }
    > main {
      padding-bottom: 6rem;
      min-width: calc(400px + 2 * 2rem);
    }
    white-space: nowrap;
    overflow-x: auto;
  }
`;

const mainHeaderCss = css`
  position: sticky;
  top: 0;

  display: flex;
  justify-content: right;
  align-items: center;
  height: 4rem;
  
  color: #444;
  background-color: #fff;
  border-bottom: 1px solid rgba(200, 200, 200, 0.5);
  font-size: 1.2rem;
  letter-spacing: 1.5rem;
`;

const overlayCss = css`
  -webkit-tap-highlight-color: transparent;
  position: absolute;
  /* z-index: 1; */
  background-color: rgba(0, 0, 0, 0.5);
  left: 0;
  top: 0;
  width: 100%;
  height: 100dvh;

  pointer-events: none;
  transition: opacity 300ms;
  opacity: 0;

  &.overlayOpen {
    cursor: pointer;
    pointer-events: all;
    opacity: 1;
  }
`;
