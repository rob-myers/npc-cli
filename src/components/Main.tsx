import React from "react";
import { css, cx } from "@emotion/css";
import Title from "./Title";
import { breakpoint } from "./const";

export default function Main(props: React.PropsWithChildren) {
  return (
    <section className={cx("main", rootCss)}>
      <Title />
      <main>{props.children}</main>
    </section>
  );
}

const rootCss = css`
  width: 100%;
  padding: 0 4rem;

  .title {
    max-width: 1024px;
    margin: 2rem auto;
  }
  main {
    max-width: 1024px;
    margin: 0 auto;
  }

  @media (max-width: ${breakpoint}) {
    padding: 0 2rem;
    overflow: scroll;
    width: initial;
  }
`;
