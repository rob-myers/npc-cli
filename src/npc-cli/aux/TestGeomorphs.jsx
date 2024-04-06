import React from "react";
import * as THREE from "three";

import { keys } from "../service/generic";
import { worldScale } from "../service/const";
import { quadGeometryXZ } from "../service/three";
import { drawPolygons, strokeLine } from "../service/dom";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function TestGeomorphs(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    drawGeomorph(gmKey, img) {
      const { ctxt, layout } = api.gmData[gmKey];
      const { pngRect, rooms, doors, navPolys } = layout;
      const canvas = ctxt.canvas;

      ctxt.clearRect(0, 0, canvas.width, canvas.width);
      ctxt.drawImage(img, 0, 0);
      ctxt.setTransform(1 / worldScale, 0, 0, 1 / worldScale, -pngRect.x / worldScale, -pngRect.y / worldScale)

      // draw hull doors
      const hullDoorPolys = doors.flatMap((x) => (x.meta.hull ? x.poly : []));
      drawPolygons(ctxt, hullDoorPolys, ["white", "#000", 0.05]);
      // 🚧 debug draw rooms
      // drawPolygons(ctxt, rooms, [null, "green", 0]);
      // 🚧 debug draw navPolys
      drawPolygons(ctxt, navPolys, ["rgba(0, 0, 0, 0.08)", "rgba(0, 0, 0, 0)", 1]);

      ctxt.resetTransform();
    },
  }));

  React.useEffect(() => {
    keys(api.gmData).forEach((gmKey) => {
      textureLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((tex) => {
        state.drawGeomorph(gmKey, tex.source.data);
        api.gmData[gmKey].tex.needsUpdate = true;
        update();
      });
    });
  }, [api.geomorphs, api.mapHash]);

  const update = useUpdate();

  return api.gms.map((gm, gmId) => (
    <group
      key={`${gm.key} ${gmId} ${gm.transform}`}
      onUpdate={(group) => group.applyMatrix4(gm.mat4)}
      // ref={(group) => group?.applyMatrix4(gm.mat4)}
    >
      <mesh
        geometry={quadGeometryXZ}
        scale={[gm.pngRect.width, 1, gm.pngRect.height]}
        position={[gm.pngRect.x, 0, gm.pngRect.y]}
      >
        <meshBasicMaterial
          side={THREE.DoubleSide}
          transparent
          map={api.gmData[gm.key].tex}
          depthWrite={false} // fix z-fighting
        />
      </mesh>
    </group>
  ));
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
