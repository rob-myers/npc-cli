import React from "react";
import { Canvas } from "@react-three/fiber";
import { css, cx } from "@emotion/css";

import useStateRef from "../hooks/use-state-ref";
import useMeasure from "react-use-measure";

/**
 * React Three Fiber Canvas wrapper
 * @template {{}} [ChildProps={}]
 * @param {Props<ChildProps>} props
 */
export default function TestCanvas(props) {
  const [measureRef, rect] = useMeasure({ scroll: false });

  const state = useStateRef(
    /** @returns {State} */ () => ({
      rootEl: /** @type {*} */ (null),
      disabled: !!props.disabled,
      bounds: rect,
      ready: false,
      handleDisabledResize() {
        const { style } = state.rootEl;
        if (state.disabled) {
          if (style.getPropertyValue("--disabled-height") === "unset") {
            style.setProperty("--disabled-height", `${state.bounds.height}px`);
          }
          if (style.getPropertyValue("--disabled-width") === "unset") {
            style.setProperty("--disabled-width", `${state.bounds.width}px`);
          }
        } else {
          style.setProperty("--disabled-height", "unset");
          style.setProperty("--disabled-width", "unset");
        }
      },
    })
  );

  state.disabled = !!props.disabled;
  state.bounds = rect;

  React.useMemo(() => {
    state.rootEl && state.handleDisabledResize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.disabled, rect.width, rect.height]);

  return (
    <Canvas
      ref={(x) => {
        measureRef(x);
        x && (state.rootEl = x);
      }}
      className={cx(canvasCss, { disabled: props.disabled })}
      frameloop={props.disabled ? "never" : "always"}
      resize={{ debounce: 300 }}
      gl={{
        // powerPreference: "lower-power", // 🔔 throws
        toneMapping: 4,
        toneMappingExposure: 1,
        // logarithmicDepthBuffer: true,
      }}
    >
      {props.childComponent ? React.createElement(props.childComponent, props.childProps) : null}
    </Canvas>
  );
}

/**
 * @template {{}} [ChildProps={}]
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {React.ComponentType<ChildProps>} [childComponent]
 * @property {ChildProps} [childProps]
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * @property {boolean} ready
 * @property {Geom.RectJson} bounds
 * @property {HTMLCanvasElement} rootEl
 * @property {() => void} handleDisabledResize
 */

/**
 * @typedef GeomorphData
 * @property {Geomorph.GeomorphKey} gmKey
 * @property {[number, number, number, number, number, number]} transform
 * @property {Geom.RectJson} pngRect
 * @property {string} debugPngPath
 */

const canvasCss = css`
  --disabled-height: unset;
  --disabled-width: unset;

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
  &.disabled {
    canvas {
      max-height: var(--disabled-height);
      min-height: var(--disabled-height);
      max-width: var(--disabled-width);
      min-width: var(--disabled-width);
    }
  }
`;
