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

  const state = useStateRef(() => ({
    rootEl: /** @type {HTMLCanvasElement} */ ({}),
  }));

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

  const [measureRef, rect] = useMeasure();

  React.useMemo(() => {
    if (props.disabled) {
      if (state.rootEl.style?.getPropertyValue("--disabled-height") === "unset") {
        state.rootEl.style?.setProperty("--disabled-height", `${rect.height}px`);
      }
    } else {
      state.rootEl.style?.setProperty("--disabled-height", 'unset');
    }
  }, [props.disabled, rect.width, rect.height]);

  return gms ? (
    <Canvas
      ref={(x) => { measureRef(x); x && (state.rootEl = x); }}
      className={cx(canvasCss, { disabled: props.disabled })}
      frameloop={props.disabled ? 'never' : 'always'}
      gl={{
        // powerPreference: "lower-power", // 🔔 throws
        toneMapping: 4,
        toneMappingExposure: 1,
      }}
    >
      <Scene gms={gms} />
    </Canvas>
  ) : null;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.GeomorphsDefItem[]} gmDefs
 */

/**
 * @typedef State
 * @property {boolean} disabled
 */

/**
 * @typedef GeomorphData
 * @property {Geomorph.GeomorphKey} gmKey
 * @property {[number, number, number, number, number, number]} transform
 * @property {Geom.RectJson} pngRect
 * @property {string} debugPngPath
 */

/**
 * @param {number} disabledHeight 
 */
const canvasCss = css`
  --disabled-height: unset;

   background-color: white;
   
   &.disabled {
     > div {
       background-color: #222;
       display: flex;
       /* flex-direction: column; */
       align-items: center;
       justify-content: center;
    }
    canvas {
      background-color: white;
      max-height: var(--disabled-height);
      min-height: var(--disabled-height);
    }
  }

`;
