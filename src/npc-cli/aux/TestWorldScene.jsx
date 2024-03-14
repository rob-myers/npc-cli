import React from "react";

import "./infinite-grid-helper.js";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function TestWorldScene(props) {
  const state = useStateRef(
    /** @returns {State} */ () => ({
      // controls: /** @type {*} */ (null),
    })
  );

  const api = React.useContext(TestWorldContext);
  api.scene = state;

  return <>{/* 🚧 */}</>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.MapDef} map
 */

/**
 * @typedef State
 * @property {'bar'} [foo]
 * //@property {{ [key in Geomorph.GeomorphKey]?: Geomorph.Layout}} layout
 * //@property {Geomorph.LayoutInstance[]} gms
 * //@property {null | Geomorph.MapLayout} map
 * //@property {{ [key in Geomorph.GeomorphKey]?: HTMLCanvasElement }} canvas
 * //@property {{ [key in Geomorph.GeomorphKey]?: THREE.CanvasTexture }} canvasTex
 * //@property {(gmKey: Geomorph.GeomorphKey, origImg: HTMLImageElement, assetsJson: Geomorph.AssetsJson) => void} drawGeomorph
 */
