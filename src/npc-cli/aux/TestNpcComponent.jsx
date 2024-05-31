import React from 'react';

/** @param {Props} props */
function TestNpcComponent(props) {
  return (
    <group
      name={props.npcKey}
      ref={props.ref}
    >
      {/* 🚧 */}
    </group>
  );
}

/**
 * @typedef Props
 * @property {import('./TestWorld').State} api
 * @property {string} npcKey
 * @property {(el: null | import('three').Group) => void} ref
 */

/** @type {React.MemoExoticComponent<(props: Props & { epochMs: number }) => JSX.Element>} */
export const MemoizedNpcComponent = React.memo(TestNpcComponent);
