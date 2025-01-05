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
    left: false,
    bubble: /** @type {*} */ (null),
    icon: /** @type {*} */ (null),

    close() {
      state.opened = false;
      state.left = false;
      state.bubble.style.removeProperty('--info-width');
      props.onChange?.(state.opened);
      update();
    },
    open(width) {
      state.opened = true;
      const root = state.bubble.closest(`[${popUpRootDataAttribute}]`) ?? document.documentElement;
      const rootRect = root.getBoundingClientRect();
    
      const rect = state.icon.getBoundingClientRect();
      const pixelsOnRight = rootRect.right - rect.right;
      const pixelsOnLeft = rect.x - rootRect.x;
      state.left = pixelsOnRight < pixelsOnLeft;
      
      state.bubble.style.setProperty('--info-arrow-delta-x', `${state.left ? 18 : 12}px`);

      const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
      width = maxWidthAvailable < (width ?? defaultInfoWidthPx) ? maxWidthAvailable : width;
      width && state.bubble.style.setProperty('--info-width', `${width}px`);

      state.icon.focus();
      props.onChange?.(state.opened);
      update();
    },
  }), { deps: [props.onChange] });

  React.useImperativeHandle(ref, () => state, []);

  return (
    <div className={cx("pop-up", rootPopupCss)}>
      <button
        ref={state.ref('icon')}
        className="pop-up-button"
        onClick={e => {
          if (state.opened) {
            state.close();
          } else {
            state.open(props.width);
          }
        }}
      >
        {props.label ?? '⋯'}
      </button>
      <div
        ref={state.ref('bubble')}
        className={cx("pop-up-bubble", {
          open: state.opened,
          left: state.left,
          right: !state.left,
        })}
      >
        <div className="arrow"/>
        <div className={cx("info", props.infoClassName)}>
          {props.children}
        </div>
      </div>
    </div>
  );
});

/**
 * @typedef Props
 * @property {number} [arrowDeltaX]
 * @property {string} [infoClassName]
 * @property {string} [label]
 * @property {number} [width]
 * @property {(willOpen: boolean) => void} [onChange]
 */

/**
 * @typedef State
 * @property {boolean} opened
 * @property {boolean} left or right
 * @property {HTMLSpanElement} bubble
 * @property {HTMLSpanElement} icon
 * @property {(width?: number | undefined) => void} open
 * @property {() => void} close
 */

const defaultInfoWidthPx = 300;

const rootPopupCss = css`
  --top-offset: 16px;
  --side-offset: 16px;

  --info-arrow-color: #ffffffaa;
  --info-arrow-delta-x: 0px;
  --info-arrow-height: 20px;
  --info-width: ${defaultInfoWidthPx}px;

  .pop-up-button {
    cursor: pointer;
    white-space: nowrap;
  }

  .pop-up-bubble {
    
    position: relative;
    z-index: ${zIndex.speechBubble};
    top: calc(-1 * var(--top-offset));
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
      min-height: 60px;

      visibility: hidden;
      opacity: 0;
      transition: opacity 300ms;
      white-space: normal;
      position: absolute;
      width: var(--info-width);
      margin-left: calc(-0.5 * var(--info-width));
    
      background-color: black;
      color: white;
      border: 1px solid var(--info-arrow-color);
    
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
      .info {
        left: calc(-0.5 * var(--info-width) - 2 * var(--info-arrow-delta-x));
        bottom: calc(-1 * var(--info-arrow-height));
      }
      .arrow {
        top: 0;
        left: calc(-2 * var(--info-arrow-delta-x));
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-left: 10px solid var(--info-arrow-color);
      }
    }
    &.right {
      .info {
        left: calc(0.5 * var(--info-width) + var(--info-arrow-delta-x) - 2px);
        bottom: calc(-1 * var(--info-arrow-height));
      }
      .arrow {
        top: 0;
        left: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-right: 10px solid var(--info-arrow-color);
      }
    }
  }
`;

export const popUpRootDataAttribute = 'data-pop-up-root';
