import React from "react";
import useStateRef from "../hooks/use-state-ref";

/**
 * Based on https://github.com/pmndrs/drei/blob/master/src/web/Html.tsx
 * @type {React.ForwardRefExoticComponent<React.PropsWithChildren<BaseProps> & React.RefAttributes<State>>}
 */
export const Draggable = React.forwardRef(function Draggable(props, ref) {

  const state = useStateRef(/** @returns {State} */ () => ({
    dragging: false,
    el: /** @type {*} */ (null),
    pos: props.initPos ?? { x: 0, y: 0 },
    rel: { x: 0, y: 0 },
    touchId: /** @type {undefined | number} */ (undefined),

    canDrag(e) {
      return props.enabled !== false;
    },
    getTouchIdentifier(e) {
      if (e.targetTouches && e.targetTouches[0]) return e.targetTouches[0].identifier;
      if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].identifier;
    },
    /**
     * @param {React.TouchEvent} e
     * @param {number} identifier
     * @returns {undefined | {clientX: number, clientY: number}}
     */
    getTouch(e, identifier) {
      return (e.targetTouches && Array.from(e.targetTouches).find(t => identifier === t.identifier)) ||
        (e.changedTouches && Array.from(e.changedTouches).find(t => identifier === t.identifier));
    },

    onMouseDown(e) {
      if (!state.canDrag(e)) {
        return;
      }
      e.stopPropagation();
      // e.preventDefault();
      state.dragging = true;
      state.rel.x = e.clientX - state.el.offsetLeft;
      state.rel.y = e.clientY - state.el.offsetTop;
    },
    onMouseUp(e) {
      // e.stopPropagation();
      // e.preventDefault();
      state.dragging = false;
    },
    onMouseMove(e) {
      if (state.dragging === false) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();

      // Subtract rel to keep the cursor "in same position"
      state.updatePos(e.clientX - state.rel.x, e.clientY - state.rel.y);
    },

    onTouchStart(e) {
      if (!state.canDrag(e)) {
        return;
      }
      state.touchId = state.getTouchIdentifier(e);
      const touchObj = typeof state.touchId  === 'number' ? state.getTouch(e, state.touchId) : null;
      if (!touchObj) {
        return null; // not the right touch
      }

      state.dragging = true;
      state.rel.x = touchObj.clientX - state.el.offsetLeft;
      state.rel.y = touchObj.clientY - state.el.offsetTop;
    },
    onTouchEnd(e) {
      state.dragging = false;
      state.touchId = undefined;
    },
    onTouchMove(e) {
      if (state.dragging === false) {
        return;
      }
      e.stopPropagation();
      
      // Subtract rel to keep the cursor "in same position"
      const touchObj = /** @type {{clientX: number, clientY: number}} */ (state.getTouch(e, /** @type {number} */ (state.touchId)));
      state.updatePos(touchObj.clientX - state.rel.x, touchObj.clientY - state.rel.y);
    },
    updatePos(x = state.pos.x, y = state.pos.y) {
      // ensure within bounds
      const container = props.container ?? document.body;
      state.pos.x = Math.max(0, Math.min(container.clientWidth - state.el.offsetWidth, x));
      state.pos.y = Math.max(0, Math.min(container.clientHeight - state.el.offsetHeight, y));
      state.el.style.left = `${state.pos.x}px`;
      state.el.style.top = `${state.pos.y}px`;
    },
  }), { deps: [props.container, props.enabled] });

  React.useImperativeHandle(ref, () => state, []);
  
  React.useEffect(() => {
    const container = props.container ?? document.body;
    const { onMouseMove, onMouseUp } = state; // for HMR
    document.body.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseUp);
    return () => {
      document.body.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseUp);
    };
  }, []);

  React.useEffect(() => {// adjust draggable onresize
    const obs = new ResizeObserver(([entry]) => state.el !== null && state.updatePos());
    const els = (props.observeSizes?.filter(x => x !== props.container) ?? []).concat(props.container ?? []);
    els.forEach(el => el instanceof HTMLElement && obs.observe(el))
    return () => obs.disconnect();
  }, [props.container, ...props.observeSizes ?? []]);

  return (
    <div
      ref={state.ref('el')}
      className={props.className}
      
      onMouseDown={state.onMouseDown}
      onMouseUp={state.onMouseUp}
      // onMouseMove={state.onMouseMove}
      // onMouseLeave={state.onMouseUp}
      onTouchStart={state.onTouchStart}
      onTouchEnd={state.onTouchEnd}
      onTouchMove={state.onTouchMove}

      style={{
        position: 'absolute',
        left: state.pos.x,
        top: state.pos.y,
      }}
    >
      {props.children}
    </div>
  )
})

/**
 * @typedef BaseProps
 * @property {string} [className]
 * @property {HTMLElement} [container]
 * So can keep draggable within container
 * @property {boolean} [enabled]
 * @property {Geom.VectJson} [initPos]
 * @property {HTMLElement[]} [observeSizes]
 * Elements whose size can effect the Draggable's position
 */

/**
 * @typedef {{
 *   dragging: boolean;
 *   el: HTMLDivElement;
 *   pos: Geom.VectJson;
 *   rel: { x: number; y: number };
 *   touchId: undefined | number;
 *   canDrag(e: React.MouseEvent | React.TouchEvent): boolean;
 *   getTouchIdentifier(e: React.TouchEvent): number | undefined;
 *   getTouch(e: React.TouchEvent, identifier: number): undefined | { clientX: number; clientY: number };
 *   onMouseDown(e: React.MouseEvent): void;
 *   onMouseUp(e: React.MouseEvent | MouseEvent): void;
 *   onMouseMove(e: React.MouseEvent | MouseEvent): void;
 *   onTouchStart(e: React.TouchEvent): null | undefined;
 *   onTouchEnd(e: React.TouchEvent): void;
 *   onTouchMove(e: React.TouchEvent): void;
 *   updatePos(x?: number, y?: number): void;
 * }} State
 */