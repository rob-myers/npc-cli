import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Canvas } from "@react-three/fiber";
import { css, cx } from "@emotion/css";

import { geomorphService } from "../service/geomorph";
import Scene from "./R3FDemoScene";
import useStateRef from "../hooks/use-state-ref";
import useMeasure from "react-use-measure";

/**
 * React Three Fiber Demo
 * @param {Props} props
 */
export default function R3FDemo(props) {

  const [measureRef, rect] = useMeasure({ scroll: false });

  const state = useStateRef(/** @returns {State} */() => ({
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
  }));

  state.disabled = !!props.disabled;
  state.bounds = rect;

  const { data: gms } = useQuery({
    queryKey: ["R3FDemo"],
    /** @returns {Promise<GeomorphData[]>} */
    async queryFn() {
      const symbolsJson = /** @type {import('static/assets/symbol/symbols-meta.json')} */ (
        await fetch(`/assets/symbol/symbols-meta.json`).then((x) => x.json())
      );
      return props.gmDefs.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }) => {
        const { pngRect } = symbolsJson[geomorphService.gmKeyToKeys(gmKey).hullKey];
        return { gmKey, transform, pngRect, debugPngPath: `/assets/debug/${gmKey}.png` };
      });
    },
    enabled: !props.disabled,
  });


  React.useMemo(() => {
    state.rootEl && state.handleDisabledResize();
  }, [props.disabled, rect.width, rect.height]);

  return (
    <Canvas
      ref={(x) => { measureRef(x); x && (state.rootEl = x); }}
      className={state.ready ? cx(canvasCss, { disabled: props.disabled }) : undefined}
      frameloop={props.disabled ? 'never' : 'always'}
      resize={{ debounce: 300 }}
      gl={{
        // powerPreference: "lower-power", // 🔔 throws
        toneMapping: 4,
        toneMappingExposure: 1,
      }}
      onCreated={() => state.ready = true}
    >
      {gms && <Scene gms={gms} />}
    </Canvas>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.GeomorphsDefItem[]} gmDefs
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
      background-color: white;
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
