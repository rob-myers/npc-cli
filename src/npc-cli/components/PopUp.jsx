import React from 'react';
import { css, cx } from '@emotion/css';
import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';

/**
 * @type {React.ForwardRefExoticComponent<React.PropsWithChildren<Props> & React.RefAttributes<State>>}
 */
export const PopUp = React.forwardRef(function PopUp(props, ref) {
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    bubble: /** @type {*} */ (null),
    icon: /** @type {*} */ (null),
    iconDownAt: null,
    left: false,
    opened: false,
    preventToggle: false,
    top: true,

    close() {
      state.opened = false;
      state.left = false;
      state.bubble.style.removeProperty('--info-width');
      props.onChange?.(state.opened);
      update();
    },
    onKeyDown(e) {
      if (e.code === 'Space') {
        state.opened ? state.close() : state.open(props.width);
      }
    },
    onPointerDownIcon(e) {
      state.iconDownAt = { x: e.clientX, y: e.clientY };
    },
    onPointerUpIcon(e) {
      const { iconDownAt } = state;
      state.iconDownAt = null;

      if (
        iconDownAt === null
        || state.preventToggle === true
        || e.nativeEvent.type !== 'pointerup'
        || Math.abs(e.clientX - iconDownAt.x) > 5
        || Math.abs(e.clientY - iconDownAt.y) > 5
      ) {
        return;
      }

      if (state.opened === true) {
        state.close();
      } else {
        state.open(props.width);
      }
    },
    open(width) {
      state.opened = true;

      const container = state.bubble.closest(`[${popUpRootDataAttribute}]`) ?? document.documentElement;
      const containerRect = container.getBoundingClientRect();
      const rect = state.icon.getBoundingClientRect();
      const pixelsOnRight = containerRect.right - rect.right;
      const pixelsOnLeft = rect.x - containerRect.x;
      state.left = pixelsOnRight < pixelsOnLeft;
      const pixelsAbove = rect.y - containerRect.y;
      const pixelsBelow = containerRect.bottom - rect.bottom;
      state.top = pixelsBelow < pixelsAbove;

      
      // 🚧 infer or parameterize `24`
      const root = /** @type {HTMLElement} */ (state.bubble.parentElement);
      root.style.setProperty('--info-arrow-delta-x', `${state.left ? 24 : 12}px`);

      const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
      width = maxWidthAvailable < (width ?? defaultInfoWidthPx) ? maxWidthAvailable : width;
      width && root.style.setProperty('--info-width', `${width}px`);

      state.icon.focus();
      props.onChange?.(state.opened);
      update();
    },
  }), { deps: [props.onChange, props.width] });

  React.useImperativeHandle(ref, () => state, []);

  return (
    <div className={cx("pop-up", rootPopupCss, props.className, { open: state.opened })}>
      <button
        ref={state.ref('icon')}
        className={popUpButtonClassName}
        onKeyDown={state.onKeyDown}
        onPointerDown={state.onPointerDownIcon}
        onPointerUp={state.onPointerUpIcon}
        onPointerLeave={state.onPointerUpIcon}
      >
        {props.label ?? '⋯'}
      </button>
      <div
        ref={state.ref('bubble')}
        className={cx("pop-up-bubble", {
          left: state.left,
          right: !state.left,
          top: state.top,
          bottom: !state.top,
        })}
      >
        <div className="arrow"/>
        <div className={popUpContentClassName}>
          {props.children}
        </div>
      </div>
    </div>
  );
});

/**
 * @typedef Props
 * @property {number} [arrowDeltaX]
 * @property {string} [className]
 * @property {string} [label]
 * @property {number} [width]
 * @property {(willOpen: boolean) => void} [onChange]
 */

/**
 * @typedef State
 * @property {boolean} top or bottom
 * @property {HTMLSpanElement} bubble
 * @property {boolean} opened
 * @property {HTMLSpanElement} icon
 * @property {null | Geom.VectJson} iconDownAt
 * @property {boolean} left or right
 * @property {boolean} preventToggle
 *
 * @property {() => void} close
 * @property {(e: React.KeyboardEvent) => void} onKeyDown
 * @property {(e: React.PointerEvent) => void} onPointerDownIcon
 * @property {(e: React.PointerEvent) => void} onPointerUpIcon
 * @property {(width?: number | undefined) => void} open
 */


const defaultInfoWidthPx = 300;

export const popUpRootDataAttribute = 'data-pop-up-root';

export const popUpButtonClassName = 'pop-up-button';
export const popUpBubbleClassName = 'pop-up-bubble';
export const popUpContentClassName = 'pop-up-content';


const rootPopupCss = css`
  --top-offset: 16px;
  --side-offset: 16px;

  --info-arrow-color: #ffffff77;
  --info-arrow-delta-x: 0px;
  --info-arrow-height: 20px;
  --info-border-color: #ffffff55;;
  --info-width: ${defaultInfoWidthPx}px;

  .${popUpButtonClassName} {
    cursor: pointer;
    white-space: nowrap;
  }

  .${popUpBubbleClassName} {
    position: relative;
    top: calc(-1 * var(--top-offset));
    /** Prevents bubble span from wrapping to next line? */
    display: inline-block;
    
    font-size: 0.95rem;
    font-style: normal;
    /* text-align: center; */
    white-space: nowrap;
    
    .${popUpContentClassName} {
      min-height: 60px;
      position: absolute;
      width: var(--info-width);

      visibility: hidden;
      opacity: 0;
      transition: opacity 300ms;
      white-space: normal;
    
      background-color: black;
      color: white;
      border: 1px solid var(--info-border-color);
    
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
      width: 0; 
      height: 0;
    }

    &.left {
      .${popUpContentClassName} {
        left: calc(-1 * var(--info-width) - 2 * var(--info-arrow-delta-x));
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
      .${popUpContentClassName} {
        left: calc(var(--info-arrow-delta-x) - 2px);
      }
      .arrow {
        top: 0;
        left: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-right: 10px solid var(--info-arrow-color);
      }
    }

    &.top .${popUpContentClassName} {
      bottom: calc(-1 * var(--info-arrow-height));
    }
    &.bottom {
      .${popUpContentClassName}, .arrow {
        top: 2px;
      }
    }
  }

  &.open .arrow,
  &.open .${popUpContentClassName}
  {
    visibility: visible;
    opacity: 1;
  }
  &:not(.open) .${popUpContentClassName} {
    right: 0; // prevent overflow scroll
  }
`;
