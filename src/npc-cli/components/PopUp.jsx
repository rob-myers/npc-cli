import React from 'react';
import { css, cx } from '@emotion/css';
import { zIndex } from '../service/const';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @type {React.ForwardRefExoticComponent<React.PropsWithChildren<Props> & React.RefAttributes<State>>}
 */
export const PopUp = React.forwardRef(function PopUp(props, ref) {
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    opened: false,
    timeoutId: 0,
    left: false,
    right: false,
    down: false,
    bubble: /** @type {*} */ (null),
    icon: /** @type {*} */ (null),

    close(ms = 100) {
      return window.setTimeout(() => {
        state.opened = false;
        state.left = false;
        state.right = false;
        state.down = false;
        state.bubble.style.removeProperty('--info-width');
        update();
      }, ms);
    },
    open(width) {
      window.clearTimeout(state.timeoutId); // clear close timeout
    
      state.opened = true;
      const root = state.bubble.closest(`[${popUpRootDataAttribute}]`) ?? document.documentElement;
      const rootRect = root.getBoundingClientRect();
    
      const rect = state.icon.getBoundingClientRect();
      const pixelsOnRight = rootRect.right - rect.right;
      const pixelsOnLeft = rect.x - rootRect.x;
      state.left = pixelsOnRight < pixelsOnLeft;
      state.right = !state.left;
      state.down = false;
      
      state.bubble.style.setProperty('--info-arrow-delta-x', `${state.left ? 20 : 12}px`);

      const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
      width = maxWidthAvailable < (width ?? defaultInfoWidthPx) ? maxWidthAvailable : width;
      width && state.bubble.style.setProperty('--info-width', `${width}px`);
      update();
    },
  }));

  React.useImperativeHandle(ref, () => state, []);

  return <>
    <span
      ref={state.ref('icon')}
      className={cx("side-note", iconTriggerCss)}
      onClick={e => {
        if (state.opened) {
          state.close();
        } else {
          state.open(props.width);
        }
      }}
    >
      ⋯
    </span>
    <span
      ref={state.ref('bubble')}
      className={cx("side-note-bubble", {
        open: state.opened,
        left: state.left,
        right: state.right,
        down: state.down,
      }, speechBubbleCss)}
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
 * @property {number} [width]
 */

/**
 * @typedef State
 * @property {boolean} opened
 * @property {number} timeoutId
 * @property {boolean} left
 * @property {boolean} right
 * @property {boolean} down
 * @property {HTMLSpanElement} bubble
 * @property {HTMLSpanElement} icon
 * @property {(width?: number | undefined) => void} open
 * @property {(ms?: number) => number} close
 */

const defaultArrowDeltaX = 20;
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

export const popUpRootDataAttribute = 'data-pop-up-root';

const hoverShowMs = 500;
