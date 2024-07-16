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
  padding: 8px 48px 8px 48px;
  border-left: 4px solid #dde;
  font-style: italic;
  
  p > strong:first-of-type {
    font-style: normal;
  }

  @media(max-width: ${breakpoint}) {
    padding: 8px 32px;
  }
`;

/**
 * @typedef {React.PropsWithChildren} Props
 */
