import React from 'react';
import { css } from "@emotion/css";
import { getRelativePointer } from '../service/dom';
import useStateRef from '../hooks/use-state-ref';
import { zIndex } from '../service/const';
import { WorldContext } from './world-context';

export default function TouchIndicator() {

  const w = React.useContext(WorldContext);

  const state = useStateRef( () => ({
    /** @param {null | HTMLDivElement} x */
    rootRef(x) {
      if (x !== null) {
        state.touchCircle = x;
        state.touchCircle.style.setProperty('--touch-radius', `${state.touchRadiusPx}px`);
        state.touchCircle.style.setProperty('--touch-fade-duration', `${state.touchFadeSecs}s`);
      }
    },
    touchCircle: /** @type {HTMLDivElement} */ ({}),
    touchRadiusPx: w.smallViewport ? 70 : 35,
    touchErrorPx: w.smallViewport ? 10 : 5,
    touchFadeSecs: w.smallViewport ? 2 : 0.2,
  }));

  React.useEffect(() => {

    /** @param {PointerEvent} e */
    function onPointerDown (e) {
      state.touchCircle.style.left = `${(e.clientX - state.touchRadiusPx)}px`;
      state.touchCircle.style.top = `${(e.clientY - state.touchRadiusPx)}px`;
      state.touchCircle.classList.add('active');
    }
    /** @param {PointerEvent} e */
    function onPointerUp (e) {
      state.touchCircle.classList.remove('active');
    }
    /** @param {PointerEvent} e */
    function onPointerMove(e) {
      if (w.view.down === undefined) {
        return;
      }
      if (w.view.down.screenPoint.distanceTo(getRelativePointer(e)) > state.touchErrorPx) {
        state.touchCircle.classList.remove('active');
      }
    }

    const el = w.view.rootEl;

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerout', onPointerUp);
    el.addEventListener('pointermove', onPointerMove);
    
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerout', onPointerUp);
      el.removeEventListener('pointermove', onPointerMove);
    };

  }, []);

  return (
    <div
      className={touchIndicatorCss}
      ref={state.rootRef}
    >
      <div className="inner-circle" />
    </div>
  );
}

const touchIndicatorCss = css`
  position: fixed;
  z-index: ${zIndex.ttyTouchCircle};

  --touch-radius: 0px;
  --touch-fade-duration: 0s;

  width: calc(2 * var(--touch-radius));
  height: calc(2 * var(--touch-radius));
  border: 2px solid white;
  border-radius: 50%;
  pointer-events:none;

  opacity: 0;
  transform: scale(0);
  transition: opacity var(--touch-fade-duration), transform ease-out var(--touch-fade-duration);
  
  &.active {
    transform: scale(1);
    opacity: 0.25;
    transition: opacity 0.3s 0.2s, transform 0.3s 0.2s;
  }

  .inner-circle {
    position: absolute;
    width: 20px;
    height: 20px;
    left: calc(var(--touch-radius) - 10px);
    top: calc(var(--touch-radius) - 10px);
    background: #f00;
    border-radius: 50%;
  }

`;
