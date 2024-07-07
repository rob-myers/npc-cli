import React from "react";
import * as THREE from "three";

import { wallHeight, gmFloorExtraScale, worldToSguScale, sguToWorldScale } from "../service/const";
import { keys } from "../service/generic";
import { drawPolygons } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Ceiling(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    tex: w.ceil.tex, // Pass in textures

    detectClick(e) {
      const gmId = Number(e.object.name.slice('ceil-gm-'.length));
      const gm = w.gms[gmId];
      
      // 3d point -> local world coords (ignoring y)
      const mat4 = gm.mat4.clone().invert();
      const localWorldPnt = e.point.clone().applyMatrix4(mat4);
      // local world coords -> canvas coords
      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      const canvasX = (localWorldPnt.x - gm.pngRect.x) * worldToCanvas;
      const canvasY = (localWorldPnt.z - gm.pngRect.y) * worldToCanvas;

      const ctxt = state.tex[gm.key][0];
      const { data: rgba } = ctxt.getImageData(canvasX, canvasY, 1, 1, { colorSpace: 'srgb' });
      // console.log(Array.from(rgba), { gmId, point3d: e.point, localWorldPnt, canvasX, canvasY });
      
      // ignore clicks on fully transparent pixels
      return rgba[3] === 0 ? null : { gmId };
    },
    drawGmKey(gmKey) {
      const [ct, tex, { width, height }] = state.tex[gmKey];
      const layout = w.geomorphs.layout[gmKey];
      const { pngRect } = layout;

      ct.resetTransform();
      ct.clearRect(0, 0, width, height);

      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      
      const { nonHullCeilTops, doorCeilTops, polyDecals } = w.gmsData[gmKey];
      
      // wall/door tops
      const strokeColor = 'rgba(140, 140, 120, 1)';
      const fillColor = 'rgba(0, 0, 0, 1)';
      const hullWalls = layout.walls.filter(x => x.meta.hull);
      drawPolygons(ct, nonHullCeilTops, [fillColor, strokeColor, 0.08]);
      drawPolygons(ct, doorCeilTops, [fillColor, strokeColor, 0.06]);
      drawPolygons(ct, hullWalls, [strokeColor, strokeColor, 0.06]);
      
      // decals
      polyDecals.filter(x => x.meta.ceil === true).forEach(x => {
        const strokeWidth = typeof x.meta.strokeWidth === 'number'
          ? x.meta.strokeWidth * sguToWorldScale
          : 0.08;
        drawPolygons(ct, x, [x.meta.fill || 'red', x.meta.stroke || 'white', strokeWidth]);
        // drawPolygons(ct, x, ['red', 'white', 0.08]);
      });

      tex.needsUpdate = true;
    },
    onPointerDown(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerdown",
          event: e,
          is3d: true,
          meta: {
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        }));
        e.stopPropagation();
      }
    },
    onPointerUp(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerup",
          event: e,
          is3d: true,
          meta: {
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        }));
        e.stopPropagation();
      }
    },
  }));

  w.ceil = state;

  React.useEffect(() => {// ensure initial + redraw on HMR
    // 🚧 handle removal from api.gms (dynamic nav-mesh)
    keys(state.tex).forEach(gmKey => state.drawGmKey(gmKey));
  }, [w.hash]);

  return <>
    {w.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name={`ceil-gm-${gmId}`}
          geometry={quadGeometryXZ}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, wallHeight, gm.pngRect.y]}
          onPointerDown={state.onPointerDown}
          onPointerUp={state.onPointerUp}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={state.tex[gm.key][1]}
            // depthWrite={false} // fix z-fighting
            alphaTest={0.9} // 0.5 flickered on (301, 101) border
          />
        </mesh>
      </group>
    ))}
  </>
  
}

0;

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {Record<Geomorph.GeomorphKey, import("../service/three").CanvasTexDef>} tex
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => null | { gmId: number; }} detectClick
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 */
