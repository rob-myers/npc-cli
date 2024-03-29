import React from "react";
import { css } from "@emotion/css";
import { Canvas } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Stats } from "@react-three/drei";

import { isTouchDevice } from "../service/dom.js";
import "./infinite-grid-helper.js";
import { Vect } from "../geom";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Origin } from "./MiscThree";

/**
 * @param {Props} props
 */
export default function TestWorldCanvas(props) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      canvasEl: /** @type {*} */ (null),
      controls: /** @type {*} */ (null),
      menuEl: /** @type {*} */ (null),
      rootEl: /** @type {*} */ (null),
      down: undefined,
      canvasRef(canvasEl) {
        if (canvasEl && !state.canvasEl) {
          state.canvasEl = canvasEl;
          state.rootEl = /** @type {*} */ (canvasEl.parentElement?.parentElement);
        }
      },
    })
  );

  const api = React.useContext(TestWorldContext);
  api.view = state;

  React.useEffect(() => {
    // state.controls?.setPolarAngle(Math.PI / 4); // Initialize view

    const sub = api.events.subscribe((e) => {
      console.log("event", e);

      switch (e.key) {
        case "pointerup":
        case "pointerup-outside":
          // show/hide ContextMenu
          if ((e.rmb || e.longPress) && e.distance <= 5) {
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

  React.useEffect(() => {
    // 🚧 do not trigger on HMR
    state.controls?.setPolarAngle(Math.PI / 4); // Initialize view
  }, [state.controls]);

  const update = useUpdate();

  return (
    <>
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
            api.events.next({
              key: "pointerup-outside",
              distance: state.down.clientPos.distanceTo({ x: e.clientX, y: e.clientY }),
              longPress: Date.now() - state.down.epochMs >= 300,
              rmb: e.button === 2,
              screenPoint: { x: e.offsetX, y: e.offsetY },
            });
        }}
        onCreated={update} // show stats
      >
        {props.stats && state.rootEl && (
          <Stats showPanel={0} className={statsCss} parent={{ current: state.rootEl }} />
        )}

        <MapControls
          ref={(x) => x && (state.controls = x)}
          makeDefault
          zoomToCursor
          {...(isTouchDevice() && {
            minAzimuthAngle: 0,
            maxAzimuthAngle: 0,
          })}
        />
        <ambientLight intensity={1} />
        <PerspectiveCamera position={[0, 8, 0]} makeDefault />
        <Origin />
        <infiniteGridHelper
          args={[1.5, 1.5, "#bbbbbb"]}
          // position={[0, -0.001, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          onPointerUp={(e) => {
            if (!state.down) {
              return;
            }
            console.log("infiniteGridHelper onPointerUp", e, e.point);
            const distance = state.down.clientPos.distanceTo({ x: e.clientX, y: e.clientY });
            const timeMs = Date.now() - state.down.epochMs;
            api.events.next({
              key: "pointerup",
              distance,
              height: e.point.y,
              longPress: timeMs >= 300,
              point: { x: e.point.x, y: e.point.z },
              rmb: e.button === 2,
              // 🤔 or clientX,Y minus canvas bounds?
              screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
              meta: {
                floor: true,
                targetCenter: undefined,
              },
            });
          }}
        />

        {props.children}
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
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {React.ReactNode} [children]
 * @property {boolean} [stats]
 */

/**
 * @typedef State
 * @property {HTMLCanvasElement} canvasEl
 * @property {import('three-stdlib').MapControls} controls
 * @property {HTMLDivElement} menuEl
 * @property {HTMLDivElement} rootEl
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
