import React from "react";
import * as THREE from "three";

import { keys } from "../service/generic";
import { worldScale } from "../service/const";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { quadGeometryXZ } from "../service/three";
import { drawPolygons, strokeLine } from "../service/dom";

/**
 * @param {Props} props
 */
export default function TestWorldScene(props) {
  const api = React.useContext(TestWorldContext);

  // prettier-ignore
  const state = useStateRef(/** @returns {State} */ () => ({
    drawGeomorph(gmKey, img) {
      const { ctxt, layout } = api.gmData[gmKey];
      const { pngRect, rooms, doors, navPolys } = layout;

      ctxt.clearRect(0, 0, pngRect.width, pngRect.width);
      ctxt.drawImage(img, 0, 0);
      ctxt.translate(-pngRect.x, -pngRect.y);

      // draw hull doors
      const hullPolys = doors.flatMap((x) => (x.meta.hull ? x.poly : []));
      drawPolygons(ctxt, hullPolys, ["white", "#000", 2]);

      // 🚧 debug draw rooms
      // drawPolygons(ctxt, rooms, [null, "green", 0]);

      // 🚧 debug draw navPolys
      drawPolygons(ctxt, navPolys, ["rgba(0, 0, 255, 0.2", "green"]);
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
  }, [api.geomorphs, api.mapKey]);

  const update = useUpdate();

  return (
    <>
      {api.gms.map((gm, gmId) => (
        <group
          key={`${gm.key} ${gmId} ${gm.transform}`}
          onUpdate={(self) => self.applyMatrix4(gm.mat4)}
          scale={[worldScale, 1, worldScale]}
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
          <mesh
            name="debugNavPoly"
            geometry={api.gmData[gm.key].debugNavPoly}
            position={[0, 0.001, 0]}
            // scale={[1, -1, 1]}
            visible={false}
          >
            <meshStandardMaterial side={THREE.FrontSide} color="green" wireframe={false} />
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
