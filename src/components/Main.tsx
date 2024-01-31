import React from "react";
import { css } from "@emotion/css";
import Title from "./Title";

export default function Main(props: React.PropsWithChildren) {
  return (
    <section className={rootCss}>
      <Title />

      <main>{props.children}</main>
    </section>
  );
}

const rootCss = css`
  width: 100%;
`;
