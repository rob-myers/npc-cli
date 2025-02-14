import React from 'react';
import { css, cx } from '@emotion/css';

/**
 * - Direction is `right` unless < 200 pixels to the right of
 *   root element, in which case direction is `left`
 * - Currently .dark-mode applies `filter: invert(1)`
 */
export default function SideNote(props: React.PropsWithChildren<{ width?: number }>) {
  const timeoutId = React.useRef(0);

  return <>
    <span
      className={cx("side-note", iconTriggerCss)}
      onClick={e => 
        open({
          bubble: e.currentTarget.nextSibling as HTMLElement,
          rect: e.currentTarget.getBoundingClientRect(),
          width: props.width,
          timeoutId: timeoutId.current,
        })
      }
      onMouseEnter={e => {
        const bubble = e.currentTarget.nextSibling as HTMLElement;
        const rect = e.currentTarget.getBoundingClientRect();
        timeoutId.current = window.setTimeout(() => open({ bubble, rect, width: props.width, timeoutId: timeoutId.current }), hoverShowMs);
      }}
      onMouseLeave={e => {
        window.clearTimeout(timeoutId.current); // clear hover timeout
        timeoutId.current = close(e, 'icon');
      }}
    >
      ⋯
    </span>
    <span
      className={cx("side-note-bubble", speechBubbleCss)}
      onMouseEnter={_ => window.clearTimeout(timeoutId.current)}
      onMouseLeave={e => (timeoutId.current = close(e, 'bubble'))} // Triggered on mobile click outside
    >
      <span className="arrow"/>
      <span className="info">
        {props.children}
      </span>
    </span>
  </>;
}

function open({ bubble, rect, width, timeoutId }: { bubble: HTMLElement; rect: DOMRect; width: number | undefined, timeoutId: number; }) {
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

function close(e: React.MouseEvent, source: 'icon' | 'bubble') {
  const bubble = (source === 'icon' ? e.currentTarget.nextSibling : e.currentTarget) as HTMLElement;
  return window.setTimeout(() => {
    bubble.classList.remove('open', 'left', 'right', 'down');
    bubble.style.removeProperty('--info-width');
  }, 100);
}

const defaultInfoWidthPx = 300;
const rootWidthPx = 16;
const arrowDeltaX = 4;

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