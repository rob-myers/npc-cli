import React from "react";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {React.PropsWithChildren<BaseProps>} props 
 */
export default function Draggable(props) {

  const state = useStateRef(() => ({
    dragging: false,
    el: /** @type {HTMLDivElement} */ ({}),
    pos: props.initPos ?? { x: 0, y: 0 },
    rel: { x: 0, y: 0 },
    touchId: /** @type {undefined | number} */ (undefined),

    /** @param {React.MouseEvent | React.TouchEvent} e */
    canDrag(e) {
      if (props.draggableClassName === undefined) {
        return true;
      } else {
        return e.target instanceof HTMLElement && e.target.classList.contains(props.draggableClassName);
      }
    },
    /** @param {React.TouchEvent} e */
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

    /** @param {React.MouseEvent} e */
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
    /** @param {React.MouseEvent | MouseEvent} e */
    onMouseUp(e) {
      e.stopPropagation();
      e.preventDefault();
      state.dragging = false;
    },
    /** @param {React.MouseEvent | MouseEvent} e */
    onMouseMove(e) {
      if (state.dragging === false) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();

      // Subtract rel to keep the cursor "in same position"
      state.updatePos(e.clientX - state.rel.x, e.clientY - state.rel.y);
    },

    /** @param {React.TouchEvent} e */
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
    /** @param {React.TouchEvent} e */
    onTouchEnd(e) {
      state.dragging = false;
      state.touchId = undefined;
    },
    /** @param {React.TouchEvent} e */
    onTouchMove(e) {
      if (state.dragging === false) {
        return;
      }
      e.stopPropagation();
      
      // Subtract rel to keep the cursor "in same position"
      const touchObj = /** @type {{clientX: number, clientY: number}} */ (state.getTouch(e, /** @type {number} */ (state.touchId)));
      state.updatePos(touchObj.clientX - state.rel.x, touchObj.clientY - state.rel.y);
    },
    /**
     * @param {number} x
     * @param {number} y
     */
    updatePos(x, y) {
      if (props.container === undefined) {
        state.pos.x = x;
        state.pos.y = y;
        return;
      }
      // ensure within bounds
      state.pos.x = Math.max(0, Math.min(props.container.clientWidth - state.el.clientWidth, x));
      state.pos.y = Math.max(0, Math.min(props.container.clientHeight - state.el.clientHeight, y));

      state.el.style.left = `${state.pos.x}px`;
      state.el.style.top = `${state.pos.y}px`;
    },
  }), { deps: [props.container] });

  React.useEffect(() => {
    document.body.addEventListener('mousemove', state.onMouseMove);
    document.body.addEventListener('mouseleave', state.onMouseUp);
    const sub = props.resizeSubject?.subscribe(() => {
      // console.log('resized');
      state.updatePos(state.pos.x, state.pos.y);
    });
    return () => {
      document.body.removeEventListener('mousemove', state.onMouseMove);
      document.body.removeEventListener('mouseleave', state.onMouseUp);
      sub?.unsubscribe();
    };
  }, [props.resizeSubject]);

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
}

/**
 * @typedef BaseProps
 * @property {string} [className]
 * @property {HTMLElement} [container] So can keep draggable within container
 * @property {string} [draggableClassName]
 * @property {Geom.VectJson} [initPos]
 * @property {import('rxjs').Subject<any>} [resizeSubject] Emits on resize
 */
