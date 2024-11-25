import React from 'react';
import { css, cx } from '@emotion/css';
import { zIndex } from '../service/const';

/**
 * This component can occur many times in a blog post.
 * It is also used in ContextMenu of World.
 * 
 * Rather than expose an api via React.forwardRef,
 * we export open/close functions directly.
 * 
 * @param {React.PropsWithChildren<Props>} props
 */
export default function SideNote(props) {
  const timeoutId = React.useRef(0);
  const onlyOnClick = props.onlyOnClick ?? false;

  return <>
    <span
      className={cx("side-note", iconTriggerCss)}
      onClick={e => {
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);
        if (isSideNoteOpen(bubble)) {
          closeSideNote(bubble);
        } else {
          openSideNote(bubble, props.width, timeoutId.current);
        }
      }}
      onMouseEnter={onlyOnClick ? undefined : e => {
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);
        timeoutId.current = window.setTimeout(() => openSideNote(bubble, props.width, timeoutId.current), hoverShowMs);
      }}
      onMouseLeave={onlyOnClick ? undefined : e => {
        window.clearTimeout(timeoutId.current); // clear hover timeout
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);
        timeoutId.current = closeSideNote(bubble);
      }}
      >
      ⋯
    </span>
    <span
      className={cx("side-note-bubble", speechBubbleCss)}
      onMouseEnter={onlyOnClick ? undefined : _ => window.clearTimeout(timeoutId.current)}
      // Triggered on mobile click outside
      onMouseLeave={onlyOnClick ? undefined : e => timeoutId.current = closeSideNote(e.currentTarget)}
    >
      <span className="arrow"/>
      <span className="info">
        {props.children}
      </span>
    </span>
  </>;
}

/**
 * @param {HTMLElement} bubble
 */
export function isSideNoteOpen(bubble) {
  return bubble.classList.contains('open');
}

/**
 * @param {HTMLElement} bubble
 * @param {number | undefined} [width]
 * @param {number | undefined} [timeoutId]
 */
export function openSideNote(bubble, width, timeoutId) {
  window.clearTimeout(timeoutId); // clear close timeout

  bubble.classList.add('open');
  const root = bubble.closest(`[${sideNoteRootDataAttribute}]`) ?? document.documentElement;
  const rootRect = root.getBoundingClientRect();

  const rect = /** @type {HTMLElement} */ (bubble.previousSibling).getBoundingClientRect();
  const pixelsOnRight = rootRect.right - rect.right;
  const pixelsOnLeft = rect.x - rootRect.x;
  bubble.classList.remove('left', 'right', 'down');
  bubble.classList.add(pixelsOnRight < pixelsOnLeft ? 'left' : 'right');
  
  const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
  width = maxWidthAvailable < (width ?? defaultInfoWidthPx) ? maxWidthAvailable : width;
  width && bubble.style.setProperty('--info-width', `${width}px`);
}

/**
 * @param {HTMLElement} bubble
 */
export function closeSideNote(bubble, ms = 100) {
  return window.setTimeout(() => {
    bubble.classList.remove('open', 'left', 'right', 'down');
    bubble.style.removeProperty('--info-width');
  }, ms);
}

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

/**
 * @typedef Props
 * @property {number} [arrowDeltaX]
 * @property {boolean} [onlyOnClick]
 * @property {number} [width]
 */
