import React from "react";
import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { css } from "@emotion/css";
import { Subject } from "rxjs";

import useStateRef from "../hooks/use-state-ref";

/**
 * @template {{ disabled?: boolean; }} [ChildProps={}]
 * @param {Props<ChildProps>} props
 */
export default function TestCanvas(props) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      canvasEl: /** @type {*} */ (null),
      menuEl: /** @type {*} */ (null),
      // 🚧 provide via useTestCanvasContext
      events: new Subject(),
      down: undefined,
    })
  );

  React.useEffect(() => {
    const sub = state.events.subscribe((e) => {
      if (e.key === "pointerup") {
        // 🚧 can show/hide ContextMenu
      }
    });
    return () => sub.unsubscribe();
  }, []);

  return (
    <>
      <Canvas
        ref={(x) => x && (state.canvasEl = x)}
        className={canvasCss}
        // "never" broke TestCharacter sporadically
        frameloop={props.disabled ? "demand" : "always"}
        resize={{ debounce: 300 }}
        gl={{ toneMapping: 4, toneMappingExposure: 1, logarithmicDepthBuffer: true }}
        onPointerDown={(e) => {
          state.down = {
            clientX: e.clientX,
            clientY: e.clientY,
            distance: 0, // or getDistance(state.input.touches)
            epochMs: Date.now(),
          };
          state.menuEl.style.display = "none";
        }}
        onPointerMissed={(e) => {
          // console.log("onPointerMissed", e.clientX, e.clientY, e);
          if (!state.down) {
            return;
          }
          const distance = Math.sqrt(
            (e.clientX - state.down.clientX) ** 2 + (e.clientY - state.down.clientY) ** 2
          );
          const timeMs = Date.now() - state.down.epochMs;
          if ((e.buttons === 2 || timeMs >= 300) && distance <= 5) {
            // RMB or longPress
            const { x, y } = state.canvasEl.getBoundingClientRect();
            state.menuEl.style.display = "block";
            state.menuEl.style.transform = `translate(${e.clientX - x}px, ${e.clientY - y - 10}px)`;
          } else {
            state.menuEl.style.display = "none";
          }
          state.down = undefined;
        }}
      >
        {React.createElement(
          props.childComponent,
          /** @type {ChildProps} */ ({
            ...props.childProps,
            disabled: props.disabled,
          })
        )}

        {props.stats && <Stats showPanel={0} />}
      </Canvas>

      {/* 🚧 */}
      <div
        ref={(x) => x && (state.menuEl = x)}
        className={contextMenuCss}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div>ContextMenu</div>
        <select defaultValue={undefined} style={{ width: "100%" }}>
          <option>choose geomorph</option>
          <option value="foo">foo</option>
          <option value="bar">bar</option>
          <option value="baz">baz</option>
        </select>
      </div>
    </>
  );
}

/**
 * @template {{ disabled?: boolean; }} [ChildProps={}]
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {boolean} [stats]
 * @property {React.ComponentType<ChildProps>} childComponent
 * @property {ChildProps} [childProps]
 */

/**
 * @typedef State
 * @property {HTMLCanvasElement} canvasEl
 * @property {HTMLDivElement} menuEl
 * @property {Subject<NPC.Event>} events
 * @property {{ clientX: number; clientY: number; distance: number; epochMs: number; }} [down]
 */

/**
 * @typedef GeomorphData
 * @property {Geomorph.GeomorphKey} gmKey
 * @property {[number, number, number, number, number, number]} transform
 * @property {Geom.RectJson} pngRect
 * @property {string} debugPngPath
 */

const canvasCss = css`
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
  z-index: 100;
  height: 100px;
  width: 120px;

  font-size: 0.9rem;
  color: white;
  background-color: black;

  padding: 8px;
  select {
    max-width: 100px;
    margin: 8px 0;
  }
`;
