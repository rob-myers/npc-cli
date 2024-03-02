import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Canvas } from "@react-three/fiber";

import { geomorphService } from "../service/geomorph";
import Scene from "./R3FDemoScene";

/**
 * React Three Fiber Demo
 * @param {Props} props
 */
export default function R3FDemo(props) {
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

  return gms ? (
    <Canvas
      frameloop={props.disabled ? 'never' : 'always'}
      gl={{
        // powerPreference: "lower-power", // 🔔 throws
        toneMapping: 4,
        toneMappingExposure: 1,
      }}
      style={{ background: "white" }}
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
