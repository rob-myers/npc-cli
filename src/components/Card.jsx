import { css } from '@emotion/css';
import React from 'react';

import { breakpoint } from 'src/const';

/** @param {Props} props */
export default function Card(props) {
  return (
    <div className={rootCss}>
      {props.children}
    </div>
  );
}

const rootCss = css`
  margin: 32px 0;
  padding: 0px 48px;
  border-left: 4px solid #dde;

  @media(max-width: ${breakpoint}) {
    padding: 0px 32px;
  }
`;

/**
 * @typedef {React.PropsWithChildren} Props
 */
