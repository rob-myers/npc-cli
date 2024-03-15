import React from "react";
import * as THREE from "three";

import { assertDefined, keys } from "../service/generic";
import { worldScale } from "../service/const";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { customQuadGeometry } from "../service/three";
import { Mat, Poly, Rect } from "../geom";
import { drawPolygons, strokeLine } from "../service/dom";
import { geomorphService } from "../service/geomorph";

/**
 * @param {Props} props
 */
export default function TestWorldScene(props) {
  /** @type {State} */
  const state = useStateRef(() => ({
    drawGeomorph(gmKey, img) {
      const { ctxt, layout } = api.gmData[gmKey];
      const { pngRect, wallSegs } = layout;
      const { hullKey } = geomorphService.gmKeyToKeys(gmKey);
      const { doors: hullDoors, floor, symbols: subSymbols } = api.assets.symbols[hullKey];
      const floors = subSymbols.map(({ symbolKey, transform }) =>
        api.assets.symbols[symbolKey].floor.clone().applyMatrix(tmpMat1.feedFromArray(transform))
      );

      ctxt.clearRect(0, 0, pngRect.width, pngRect.width);
      ctxt.drawImage(img, 0, 0);

      // 🚧
      ctxt.lineWidth = 2;
      ctxt.translate(-pngRect.x, -pngRect.y);
      ctxt.strokeStyle = "rgba(0, 0, 0, 0)";
      ctxt.fillStyle = "rgba(0, 255, 0, 0.2)";
      drawPolygons(ctxt, floor, "fill-stroke");
      ctxt.fillStyle = "rgba(0, 0, 255, 0.2)";
      drawPolygons(ctxt, floors, "fill-stroke");
      ctxt.strokeStyle = "rgba(0, 0, 0, 1)";
      ctxt.fillStyle = "rgba(255, 255, 255, 1)";
      drawPolygons(ctxt, hullDoors, "fill-stroke");

      ctxt.lineWidth = 4;
      ctxt.strokeStyle = "rgba(255, 0, 0, 1)";
      wallSegs.map(([u, v]) => strokeLine(ctxt, u, v));
      ctxt.resetTransform();
    },
  }));

  const api = React.useContext(TestWorldContext);
  api.scene = state;

  React.useLayoutEffect(() => {
    keys(api.gmData).forEach((gmKey) => {
      textureLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((tex) => {
        const img = /** @type {HTMLImageElement} */ (tex.source.data);
        state.drawGeomorph(gmKey, img);
        assertDefined(api.gmData[gmKey].tex).needsUpdate = true;
        update();
      });
    });
  }, [api.assets, api.map]);

  const update = useUpdate();

  return (
    <>
      {api.gms.map((gm, gmId) => (
        <group key={gm.transform.toString()} onUpdate={(self) => self.applyMatrix4(gm.mat4)}>
          <mesh
            scale={[gm.pngRect.width * worldScale, 1, gm.pngRect.height * worldScale]}
            geometry={customQuadGeometry}
            position={[gm.pngRect.x * worldScale, 0, gm.pngRect.y * worldScale]}
          >
            <meshBasicMaterial
              side={THREE.DoubleSide}
              transparent
              map={api.gmData[gm.key].tex}
              depthWrite={false} // fix z-fighting
            ></meshBasicMaterial>
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {(gmKey: Geomorph.GeomorphKey, img: HTMLImageElement) => void} drawGeomorph
 */

const textureLoader = new THREE.TextureLoader();
const tmpMat1 = new Mat();
