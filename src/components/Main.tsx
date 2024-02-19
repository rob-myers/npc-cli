import { Link } from "gatsby";
import React from "react";
import { css, cx } from "@emotion/css";
import { afterBreakpoint, breakpoint } from "./const";
import npcCliTitlePng from "../../static/assets/npc-cli-title.png";
import useSite from "src/store/site.store";

export default function Main(props: React.PropsWithChildren) {
  const navOpen = useSite((x) => x.navOpen);

  return (
    <section className={mainCss} data-testid="main">
      <div
        className={cx(overlayCss, {
          overlayOpen: navOpen && useSite.api.isSmall(),
        })}
        onClick={() => useSite.api.toggleNav()}
      />

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
  white-space: nowrap;
  overflow-x: scroll;

  > main {
    max-width: 1024px;
    margin: 0 auto;
  }

  @media (min-width: ${afterBreakpoint}) {
    > main {
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
    // 🔔 Too wide caused extra body height (mobile)
    /* max-width: 100%; */
  }

  @media (min-width: ${afterBreakpoint}) {
    padding: 0 4rem;
  }
`;

const overlayCss = css`
  position: absolute;
  background-color: rgba(0, 0, 0, 0.5);
  left: 0;
  top: 0;
  width: 100%;
  height: 100dvh;
  cursor: pointer;
  z-index: 6;

  display: none;
  &.overlayOpen {
    display: block;
  }
`;
