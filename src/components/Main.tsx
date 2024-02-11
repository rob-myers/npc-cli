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

  @media(max-width: ${breakpoint}) {
    overflow: scroll;
    width: initial;
  }
`;
