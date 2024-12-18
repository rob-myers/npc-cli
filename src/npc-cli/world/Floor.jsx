import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { geomorphGridMeters, gmFloorExtraScale, worldToSguScale } from "../service/const";
import { pause } from "../service/generic";
import { getGridPattern, drawCircle, drawPolygons, drawSimplePoly } from "../service/dom";
import { geomorph } from "../service/geomorph";
import { InstancedMultiTextureMaterial } from "../service/glsl";
import { emptyDataArrayTexture, getQuadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Floor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    grid: getGridPattern(geomorphGridMeters * worldToCanvas, 'rgba(100, 100, 100, 0.25)'),
    inst: /** @type {*} */ (null),
    quad: getQuadGeometryXZ(`${w.key}-multi-tex-floor-xz`),

    addUvs() {
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const uvTextureIds = /** @type {number[]} */ ([]);
      /** `[0, 1, ..., maxGmId]` */
      const instanceIds = /** @type {number[]} */ ([]);

      for (const [gmId, gm] of w.gms.entries()) {
        uvOffsets.push(0, 0);
        // 🔔 edge geomorph 301 pngRect height/width ~ 0.5 (not equal)
        uvDimensions.push(1, geomorph.isEdgeGm(gm.key) ? (gm.pngRect.height / gm.pngRect.width) : 1);
        uvTextureIds.push(w.gmsData.getTextureId(gm.key));
        instanceIds.push(gmId);
      }

      state.inst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.inst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
      state.inst.geometry.setAttribute('uvTextureIds',
        new THREE.InstancedBufferAttribute(new Int32Array(uvTextureIds), 1),
      );
      state.inst.geometry.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Int32Array(instanceIds), 1),
      );
    },
    async draw() {
      w.menu.measure('floor.draw');
      for (const [texId, gmKey] of w.gmsData.seenGmKeys.entries()) {
        state.drawGmKey(gmKey);
        w.gmsData.texFloor.updateIndex(texId);
        await pause();
      }
      w.gmsData.texFloor.update();
      w.menu.measure('floor.draw');
    },
    drawGmKey(gmKey) {
      const { ct } = w.gmsData.texFloor;
      const gm = w.geomorphs.layout[gmKey];
      const { pngRect, hullPoly, navDecomp, walls } = gm;

      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.fillStyle = 'red';
      ct.strokeStyle = 'green';

      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);

      // Floor
      drawPolygons(ct, hullPoly.map(x => x.clone().removeHoles()), ['#333', null]);
      // drawPolygons(ct, hullPoly.map(x => x.clone().removeHoles()), ['#fff', null]);

      // Nav-mesh
      const triangles = navDecomp.tris.map(tri => new Poly(tri.map(i => navDecomp.vs[i])));
      const navPoly = Poly.union(triangles);
      drawPolygons(ct, navPoly, ['rgba(40, 40, 40, 1)', '#777', 0.025]);
      // drawPolygons(ct, navPoly, ['#aaaaaa55', '#999999bb', 0.03]);
      
      // drawPolygons(ct, triangles, [null, 'rgba(200, 200, 200, 0.3)', 0.01]); // outlines

      // draw grid
      ct.setTransform(1, 0, 0, 1, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      ct.fillStyle = state.grid;
      ct.fillRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);

      // cover hull doorway z-fighting (visible from certain angles)
      gm.hullDoors.forEach(hullDoor => {
        const poly = hullDoor.computeDoorway(true);
        const [p, q, r, s] = poly.outline;
        drawPolygons(ct, poly, ['#000', '#333', 0.025]);
        ct.strokeStyle = '#777';
        ct.beginPath(); ct.moveTo(q.x, q.y); ct.lineTo(r.x, r.y); ct.stroke();
        ct.beginPath(); ct.moveTo(s.x, s.y); ct.lineTo(p.x, p.y); ct.stroke();
      });

      // Walls
      drawPolygons(ct, walls, ['black', null]);
      // // Doors
      // drawPolygons(ct, doors.map((x) => x.poly), ["rgba(0, 0, 0, 0)", "black", 0.02]);

      // drop shadows (avoid doubling e.g. bunk bed, overlapping tables)
      const shadowColor = 'rgba(0, 0, 0, 0.25)'
      const shadowPolys = Poly.union(gm.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(ct, shadowPolys, [shadowColor, null]);

      // debug decor: moved to <Debug/>
      // // ct.setTransform(worldToSgu, 0, 0, worldToSgu, -pngRect.x * worldToSgu, -pngRect.y * worldToSgu);
      // gm.decor.forEach((decor) => {
      //   if (decor.type === 'circle') {
      //     drawCircle(ct, decor.center, decor.radius, [null, '#009', 0.04]);
      //   } else if (decor.type === 'rect') {
      //     drawSimplePoly(ct, decor.points, [null, '#070', 0.04]);
      //   }
      // });

      // 🧪 debug original geomorph image
      // imageLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((img) => {
      //   ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      //   ct.globalAlpha = 0.2;
      //   ct.drawImage(img, 0, 0, img.width, img.height, pngRect.x, pngRect.y, pngRect.width, pngRect.height);
      //   ct.globalAlpha = 1;
      //   ct.resetTransform();
      //   tex.needsUpdate = true;
      // });

      ct.resetTransform();
    },
    positionInstances() {
      for (const [gmId, gm] of w.gms.entries()) {
        const mat = (new Mat([gm.pngRect.width, 0, 0, gm.pngRect.height, gm.pngRect.x, gm.pngRect.y])).postMultiply(gm.matrix);
        // if (mat.determinant < 0) mat.preMultiply([-1, 0, 0, 1, 1, 0])
        state.inst.setMatrixAt(gmId, geomorph.embedXZMat4(mat.toArray()));
      }
      state.inst.instanceMatrix.needsUpdate = true;
      state.inst.computeBoundingSphere();
    },
  }), { reset: { grid: true } });

  w.floor = state;

  React.useEffect(() => {
    state.draw();
    state.positionInstances();
    state.addUvs();
  }, [w.mapKey, w.hash.full]);

  return (
    <instancedMesh
      name={"multi-tex-floor"}
      ref={instances => void (instances && (state.inst = instances))}
      args={[state.quad, undefined, w.gms.length]}
      renderOrder={-3} // 🔔 must render before other transparent e.g. npc drop shadow
    >
      {/* <meshBasicMaterial color="red" side={THREE.DoubleSide} /> */}
      <instancedMultiTextureMaterial
        key={InstancedMultiTextureMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={w.gmsData.texFloor.tex ?? emptyDataArrayTexture}
        depthWrite={false} // fix z-fighting
        // diffuse={[1, 1, 0.8]}
        diffuse={[1, 1, 1]}
        objectPickRed={2}
        alphaTest={0.5}
        colorSpace
      />
    </instancedMesh>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.InstancedMesh} inst
 * @property {CanvasPattern} grid
 * @property {THREE.BufferGeometry} quad
 *
 * @property {() => void} addUvs
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 * @property {() => void} positionInstances
 */

const tmpMat1 = new Mat();
const worldToCanvas = worldToSguScale * gmFloorExtraScale;
