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
  padding: 32px 64px;
  background-color: #eee;
  border-top: 4px solid #ddd;
  
  @media(max-width:${breakpoint}) {
    padding: 32px;
  }
`;

/**
 * @typedef {React.PropsWithChildren} Props
 */
