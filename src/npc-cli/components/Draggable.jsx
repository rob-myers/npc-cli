import React from "react";
import useStateRef from "../hooks/use-state-ref";

/**
 * https://stackoverflow.com/a/20927899/2917822
 * @param {React.PropsWithChildren<BaseProps>} props 
 */
export default function Draggable(props) {

  const state = useStateRef(() => ({
    dragging: false,
    el: /** @type {HTMLDivElement} */ ({}),
    pos: props.initPos ?? { x: 0, y: 0 },
    rel: { x: 0, y: 0 },

    /** @param {React.PointerEvent} e */
    onPointerDown(e) {
      e.stopPropagation();
      e.preventDefault();
      state.dragging = true;
      state.rel.x = e.clientX - state.el.offsetLeft;
      state.rel.y = e.clientY - state.el.offsetTop;
    },
    /** @param {React.PointerEvent} e */
    onPointerUp(e) {
      e.stopPropagation();
      e.preventDefault();
      state.dragging = false;
    },
    /** @param {React.PointerEvent} e */
    onPointerMove(e) {
      if (state.dragging === false) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();

      // Subtract rel to keep the cursor "in same position"
      state.pos.x = e.clientX - state.rel.x;
      state.pos.y = e.clientY - state.rel.y;
      state.el.style.left = `${state.pos.x}px`;
      state.el.style.top = `${state.pos.y}px`;
    },
  }));

  return (
    <div
      ref={state.ref('el')}
      className={props.className}
      onPointerDown={state.onPointerDown}
      onPointerUp={state.onPointerUp}
      onPointerMove={state.onPointerMove}
      onPointerOut={state.onPointerUp}
      style={{
        position: 'absolute',
        // zIndex: 100,
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
 * @property {Geom.VectJson} [initPos]
 */