import React from 'react';
import { css, cx } from '@emotion/css';
import { zIndex } from '../service/const';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * This component can occur many times in a blog post.
 * It is also used in `ContextMenu` of `World`.
 * 
 * @type {React.ForwardRefExoticComponent<React.PropsWithChildren<Props> & React.RefAttributes<State>>}
 */
export const SideNote = React.forwardRef(function SideNote(props, ref) {
  const onlyOnClick = props.onlyOnClick ?? false;

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    open: false,
    timeoutId: 0,
    left: false,
    right: false,
    down: false,

    closeSideNote(bubble, ms = 100) {
      return window.setTimeout(() => {
        state.open = false;
        state.left = false;
        state.right = false;
        state.down = false;
        bubble.style.removeProperty('--info-width');
        update();
      }, ms);
    },
    openSideNote(bubble, width) {
      window.clearTimeout(state.timeoutId); // clear close timeout
    
      state.open = true;
      const root = bubble.closest(`[${sideNoteRootDataAttribute}]`) ?? document.documentElement;
      const rootRect = root.getBoundingClientRect();
    
      const rect = /** @type {HTMLElement} */ (bubble.previousSibling).getBoundingClientRect();
      const pixelsOnRight = rootRect.right - rect.right;
      const pixelsOnLeft = rect.x - rootRect.x;
      state.left = pixelsOnRight < pixelsOnLeft;
      state.right = !state.left;
      state.down = false;
      
      const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
      width = maxWidthAvailable < (width ?? defaultInfoWidthPx) ? maxWidthAvailable : width;
      width && bubble.style.setProperty('--info-width', `${width}px`);
      update();
    },
  }));

  React.useImperativeHandle(ref, () => state, []);

  return <>
    <span
      className={cx("side-note", iconTriggerCss)}
      onClick={e => {
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);
        if (state.open) {
          state.closeSideNote(bubble);
        } else {
          state.openSideNote(bubble, props.width);
        }
      }}
      onMouseEnter={onlyOnClick ? undefined : e => {
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);
        state.timeoutId = window.setTimeout(() => state.openSideNote(bubble, props.width), hoverShowMs);
      }}
      onMouseLeave={onlyOnClick ? undefined : e => {
        window.clearTimeout(state.timeoutId); // clear hover timeout
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);
        state.timeoutId = state.closeSideNote(bubble);
      }}
      >
      ⋯
    </span>
    <span
      className={cx("side-note-bubble", {
        open: state.open,
        left: state.left,
        right: state.right,
        down: state.down,
      }, speechBubbleCss)}
      onMouseEnter={onlyOnClick ? undefined : _ => window.clearTimeout(state.timeoutId)}
      // Triggered on mobile click outside
      onMouseLeave={onlyOnClick ? undefined : e => state.timeoutId = state.closeSideNote(e.currentTarget)}
    >
      <span className="arrow"/>
      <span className="info">
        {props.children}
      </span>
    </span>
  </>;
});

/**
 * @typedef Props
 * @property {number} [arrowDeltaX]
 * @property {boolean} [onlyOnClick]
 * @property {number} [width]
 */

/**
 * @typedef State
 * @property {boolean} open
 * @property {number} timeoutId
 * @property {boolean} left
 * @property {boolean} right
 * @property {boolean} down
 * @property {(bubble: HTMLElement, width?: number | undefined) => void} openSideNote
 * @property {(bubble: HTMLElement, ms?: number) => number} closeSideNote
 */

const defaultArrowDeltaX = 8;
const defaultInfoWidthPx = 300;
const rootWidthPx = 16;

const iconTriggerCss = css`
  width: ${rootWidthPx}px;
  cursor: pointer;
  white-space: nowrap;
  
  padding: 0 4px;
  border-radius: 10px;
  border: 1px solid #aaaaaa;
  background-color: white;
  color: black;
  font-size: 0.95rem;
  font-style: normal;
`;

const speechBubbleCss = css`
  --info-arrow-delta-x: ${defaultArrowDeltaX}px;
  --info-width: ${defaultInfoWidthPx}px;

  position: relative;
  z-index: ${zIndex.speechBubble};
  top: ${-rootWidthPx}px;
  /** Prevents bubble span from wrapping to next line? */
  display: inline-block;

  font-size: 0.95rem;
  font-style: normal;
  text-align: center;
  white-space: nowrap;

  &.open .arrow,
  &.open .info
  {
    visibility: visible;
    opacity: 1;
  }
  &:not(.open) .info {
    right: 0; // prevent overflow scroll
  }

  .info {
    visibility: hidden;
    opacity: 0;
    transition: opacity 300ms;
    white-space: normal;
    position: absolute;
    width: var(--info-width);
    margin-left: calc(-0.5 * var(--info-width));
    padding: 16px;
    line-height: 1.6;

    background-color: black;
    color: white;
    border-radius: 4px;
    border: 2px solid #444;

    a {
      color: #dd0;
    }
    code {
      font-size: inherit;
    }
  }
  .arrow {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    z-index: 1;
    width: 0; 
    height: 0;
  }

  &.left {
    left: ${-1.5 * rootWidthPx}px;
    .info {
      top: -16px;
      left: calc(-1 * (0.5 * var(--info-width) + var(--info-arrow-delta-x) ));
    }
    .arrow {
      top: 0;
      left: calc(-1 * var(--info-arrow-delta-x));
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 10px solid #444;
    }
  }
  &.right {
    left: ${-rootWidthPx}px;
    .info {
      top: -16px;
      left: calc(${rootWidthPx}px + 0.5 * var(--info-width) + var(--info-arrow-delta-x));
    }
    .arrow {
      top: 0;
      left: calc(${rootWidthPx / 2}px + var(--info-arrow-delta-x));
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-right: 10px solid #444;
    }
  }
  &.down {
    .info {
      top: 20px;
    }
    .arrow {
      top: calc(-10px + 20px);
      left: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 10px solid #444;
    }
  }
`;

export const sideNoteRootDataAttribute = 'data-side-note-root';

const hoverShowMs = 500;

