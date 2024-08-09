import { Link } from 'gatsby';
import React from 'react';

/**
 * @param {React.PropsWithChildren<{ id: string }>} props 
 */
export default function ScrollTo(props) {
  return (
    <Link
      to={`#${props.id}`}
      onClick={e => {
        e.preventDefault();
        document.getElementById(props.id)?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {props.children}
    </Link>
  )
}
