import React from 'react';
import { css, cx } from '@emotion/css';
import { zIndex } from '../service/const';

/**
 * @param {React.PropsWithChildren<{
 *   width?: number;
 *   onlyOnClick?: boolean;
 * }>} props
 */
export default function SideNote(props) {
  const timeoutId = React.useRef(0);
  const onlyOnClick = props.onlyOnClick ?? false;

  return <>
    <span
      className={cx("side-note", iconTriggerCss)}
      onClick={e => {
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);

        if (bubble.classList.contains('open')) {
          close(e, 'icon');
        } else {
          open({
            bubble,
            rect: e.currentTarget.getBoundingClientRect(),
            width: props.width,
            timeoutId: timeoutId.current,
          });
        }
      }}
      onMouseEnter={onlyOnClick ? undefined : e => {
        const bubble = /** @type {HTMLElement} */ (e.currentTarget.nextSibling);
        const rect = e.currentTarget.getBoundingClientRect();
        timeoutId.current = window.setTimeout(() => open({ bubble, rect, width: props.width, timeoutId: timeoutId.current }), hoverShowMs);
      }}
      onMouseLeave={onlyOnClick ? undefined : e => {
        window.clearTimeout(timeoutId.current); // clear hover timeout
        timeoutId.current = close(e, 'icon');
      }}
      >
      ⋯
    </span>
    <span
      className={cx("side-note-bubble", speechBubbleCss)}
      onMouseEnter={onlyOnClick ? undefined : _ => window.clearTimeout(timeoutId.current)}
      onMouseLeave={onlyOnClick ? undefined : e => timeoutId.current = close(e, 'bubble')} // Triggered on mobile click outside
    >
      <span className="arrow"/>
      <span className="info">
        {props.children}
      </span>
    </span>
  </>;
}

/**
 * @param {{ bubble: HTMLElement; rect: DOMRect; width: number | undefined, timeoutId: number; }} param0 
 */
function open({ bubble, rect, width, timeoutId }) {
  window.clearTimeout(timeoutId); // clear close timeout

  bubble.classList.add('open');
  
  const root = document.querySelector(`[${sideNoteRootDataAttribute}]`) ?? document.documentElement;
  const rootRect = root.getBoundingClientRect();
  const pixelsOnRight = rootRect.right - rect.right;
  const pixelsOnLeft = rect.x - rootRect.x;
  bubble.classList.remove('left', 'right', 'down');
  bubble.classList.add(pixelsOnRight < pixelsOnLeft ? 'left' : 'right');
  
  const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
  width = maxWidthAvailable < (width ?? defaultInfoWidthPx) ? maxWidthAvailable : width;
  width && bubble.style.setProperty('--info-width', `${width}px`);
}

/**
 * @param {React.MouseEvent} e 
 * @param {'icon' | 'bubble'} source 
 */
function close(e, source) {
  const bubble = /** @type {HTMLElement} */ (source === 'icon' ? e.currentTarget.nextSibling : e.currentTarget);
  return window.setTimeout(() => {
    bubble.classList.remove('open', 'left', 'right', 'down');
    bubble.style.removeProperty('--info-width');
  }, 100);
}

const defaultInfoWidthPx = 300;
const rootWidthPx = 16;
const arrowDeltaX = 8;

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
  }
  &:not(.open) .info {
    right: 0; // prevent overflow scroll
  }

  .info {
    visibility: hidden;
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
    position: absolute;
    z-index: 1;
    width: 0; 
    height: 0;
  }

  &.left {
    left: ${-1.5 * rootWidthPx}px;
    .info {
      top: -16px;
      left: calc(-1 * (0.5 * var(--info-width) + ${arrowDeltaX}px ));
    }
    .arrow {
      top: 0;
      left: -${arrowDeltaX}px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 10px solid #444;
    }
  }
  &.right {
    left: ${-rootWidthPx}px;
    .info {
      top: -16px;
      left: calc(${rootWidthPx}px + 0.5 * var(--info-width) + ${arrowDeltaX}px);
    }
    .arrow {
      top: 0;
      left: ${rootWidthPx/2 + arrowDeltaX}px;
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