import React from "react";
import { css, cx } from "@emotion/css";
import { breakpoint } from "./const";
import npcCliTitlePng from "../../static/assets/npc-cli-title.png";
import useSite from "src/store/site.store";

export default function Main(props: React.PropsWithChildren) {
  const navOpen = useSite((x) => x.navOpen);

  return (
    <section className={mainCss} data-testid="main">
      <div
        className={cx(overlayCss, {
          overlayOpen: navOpen && useSite.api.isSmallViewport(),
        })}
        onClick={() => useSite.api.toggleNav()}
      />

      <div className={mainTitleCss} data-testid="main-title">
        <img src={npcCliTitlePng} />
      </div>

      <main>{props.children}</main>
    </section>
  );
}

const mainCss = css`
  width: 100%;
  padding: 0 4rem;

  @media (max-width: ${breakpoint}) {
    padding: 0 2rem;
    overflow: scroll;
    width: initial;
  }

  > main {
    max-width: 1024px;
    margin: 0 auto;
  }
`;

const mainTitleCss = css`
  max-width: 1024px;
  margin: 2rem auto;
  img {
    // 🔔 Too wide caused extra body height (mobile)
    max-width: 100%;
  }
`;

const overlayCss = css`
  position: absolute;
  background-color: rgba(0, 0, 0, 0.5);
  left: 0;
  width: 100%;
  height: 100dvh;
  cursor: pointer;
  z-index: 6;

  display: none;
  &.overlayOpen {
    display: block;
  }
`;
