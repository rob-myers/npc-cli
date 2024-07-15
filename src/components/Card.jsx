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
  padding: 16px 48px 32px 48px;
  background-color: #eee;
  border-left: 4px solid #ddd;
  font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  
  @media(max-width:${breakpoint}) {
    margin: 16px 0 24px;
    padding: 8px 32px 20px 32px;
  }
`;

/**
 * @typedef {React.PropsWithChildren} Props
 */
