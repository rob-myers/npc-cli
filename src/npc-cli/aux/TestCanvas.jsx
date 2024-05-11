import React from "react";
import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { css } from "@emotion/css";
import { Subject } from "rxjs";

import { Vect } from "../geom";
import { TestCanvasContext } from "./test-canvas-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @template {{ disabled?: boolean; }} [ChildProps={}]
 * @param {Props<ChildProps>} props
 */
export default function TestCanvas(props) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      canvasEl: /** @type {*} */ (null),
      menuEl: /** @type {*} */ (null),
      rootEl: /** @type {*} */ (null),
      events: new Subject(),
      down: undefined,
      canvasRef(canvasEl) {
        if (canvasEl && !state.canvasEl) {
          state.canvasEl = canvasEl;
          state.rootEl = /** @type {*} */ (canvasEl.parentElement?.parentElement);
        }
      },
    })
  );

  React.useEffect(() => {
    const sub = state.events.subscribe((e) => {
      console.log("event", e);

      switch (e.key) {
        case "pointerup":
        case "pointerup-outside":
          // show/hide ContextMenu
          if ((e.rmb || e.longPress) && e.distancePx <= 5) {
            state.menuEl.style.transform = `translate(${e.screenPoint.x}px, ${e.screenPoint.y}px)`;
            state.menuEl.style.display = "block";
          } else {
            state.menuEl.style.display = "none";
          }
          state.down = undefined;
          break;
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const update = useUpdate();

  return (
    <TestCanvasContext.Provider value={state}>
      <Canvas
        ref={state.canvasRef}
        className={canvasCss}
        // "never" broke TestCharacter sporadically
        frameloop={props.disabled ? "demand" : "always"}
        resize={{ debounce: 300 }}
        gl={{ toneMapping: 4, toneMappingExposure: 1, logarithmicDepthBuffer: true }}
        onPointerDown={(e) => {
          state.down = {
            clientPos: new Vect(e.clientX, e.clientY),
            distance: 0, // or getDistance(state.input.touches)
            epochMs: Date.now(),
          };
          state.menuEl.style.display = "none";
        }}
        onPointerMissed={(e) => {
          // console.log("onPointerMissed", e.clientX, e.clientY, e);
          state.down &&
            state.events.next({
              key: "pointerup-outside",
              distancePx: state.down.clientPos.distanceTo({ x: e.clientX, y: e.clientY }),
              longPress: Date.now() - state.down.epochMs >= 300,
              rmb: e.button === 2,
              screenPoint: { x: e.offsetX, y: e.offsetY },
            });
        }}
        onCreated={update} // show stats
        shadows={props.shadows}
      >
        {React.createElement(
          props.childComponent,
          /** @type {ChildProps} */ ({
            ...props.childProps,
            disabled: props.disabled,
          })
        )}

        {props.stats && state.rootEl && (
          <Stats showPanel={0} className={statsCss} parent={{ current: state.rootEl }} />
        )}
      </Canvas>

      <div
        ref={(x) => x && (state.menuEl = x)}
        className={contextMenuCss}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div>ContextMenu</div>
        <select defaultValue={undefined} style={{ width: "100%" }}>
          <option>demo select</option>
          <option value="foo">foo</option>
          <option value="bar">bar</option>
          <option value="baz">baz</option>
        </select>
      </div>
    </TestCanvasContext.Provider>
  );
}

/**
 * @template {{ disabled?: boolean; }} [ChildProps={}]
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {boolean} [stats]
 * @property {boolean} [shadows]
 * @property {React.ComponentType<ChildProps>} childComponent
 * @property {ChildProps} [childProps]
 */

/**
 * @template {{}} [T={}]
 * @typedef {BaseState & T} State<T> Generic so child components can extend it.
 */

/**
 * @typedef BaseState
 * @property {HTMLCanvasElement} canvasEl
 * @property {HTMLDivElement} menuEl
 * @property {HTMLDivElement} rootEl
 * @property {Subject<NPC.Event>} events
 * @property {{ clientPos: Geom.Vect; distance: number; epochMs: number; }} [down]
 * @property {(canvasEl: null | HTMLCanvasElement) => void} canvasRef
 */

const canvasCss = css`
  user-select: none;

  > div {
    background-color: black;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  canvas {
    background-color: rgba(255, 255, 255, 1);
    width: 100%;
    height: 100%;
  }
`;

const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  height: 100px;

  font-size: 0.9rem;
  color: white;
  background-color: #222;
  border-radius: 5px;
  border: 2px solid #aaa;

  padding: 8px;

  select {
    max-width: 100px;
    margin: 8px 0;
  }
`;

const statsCss = css`
  position: absolute !important;
  z-index: 4 !important;
  left: unset !important;
  right: 0px;
`;
