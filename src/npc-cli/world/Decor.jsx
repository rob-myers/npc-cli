import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { pause, testNever } from "../service/generic";
import { tmpMat1, tmpRect1 } from "../service/geom";
import { geomorphService } from "../service/geomorph";
import { addToDecorGrid, removeFromDecorGrid } from "../service/grid";
import { boxGeometry, quadGeometryXZ, tmpMatFour1 } from "../service/three";
import * as glsl from "../service/glsl";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/** @param {Props} props */
export default function Decor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    cuboidInst: /** @type {*} */ (null),
    cuboidCount: 0,
    quadCount: 0,
    quadInst: /** @type {*} */ (null),

    byGrid: [],
    byRoom: [],
    decor: {},
    nextDecorCid: 0,

    addDecor(ds) {
      const grouped = ds.reduce((agg, d) => {
        const { gmId, roomId } = state.ensureGmRoomId(d);
        (agg[geomorphService.getGmRoomKey(gmId, roomId)]
          ??= { gmId, roomId, add: [], remove: [] }
        ).add.push(d);
        
        const prev = state.decor[d.key];
        if (prev) {// Add pre-existing decor to removal group
          d.updatedAt = Date.now();
          const { gmId, roomId } = prev.meta;
          (agg[geomorphService.getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).remove.push(prev);
        }
        return agg;
      }, /** @type {Record<`g${number}r${number}`, Geomorph.GmRoomId & { [x in 'add' | 'remove']: Geomorph.Decor[] }>} */ ({}));

      for (const { gmId, roomId, remove } of Object.values(grouped)) {
        state.removeRoomDecor(gmId, roomId, remove);
      }
      for (const { gmId, roomId, add } of Object.values(grouped)) {
        state.addRoomDecor(gmId, roomId, add);
      }
    },
    addQuadUvs() {
      // 🚧
    },
    addRoomDecor(gmId, roomId, ds) {
      const atRoom = state.byRoom[gmId][roomId];

      for (const d of ds) {
        if (d.key in state.decor) {
          continue;
        }
        addToDecorGrid(d, state.byGrid);

        state.decor[d.key] = d;
        atRoom.decor[d.key] = d;

        if (geomorphService.isDecorPoint(d)) {
          atRoom.points.push(d);
        } else if (geomorphService.isDecorCollidable(d)) {
          atRoom.colliders.push(d);
        } // else 'cuboid'

        // 🔔 not every non-cuboid has associated quad?
        d.type === 'cuboid' ? state.cuboidCount++ : state.quadCount++;
      }

      ds.length && w.events.next({ key: 'decors-added', decors: ds });
    },
    createCuboidMatrix4(cuboidDecor) {
      const [mat, mat4] = [tmpMat1, tmpMatFour1];
      mat.feedFromArray([cuboidDecor.extent.x * 2, 0, 0, cuboidDecor.extent.z * 2, cuboidDecor.center.x, cuboidDecor.center.z]);
      return geomorphService.embedXZMat4(mat.toArray(), { mat4, yHeight: cuboidDecor.center.y, yScale: cuboidDecor.extent.y * 2 });
    },
    ensureGmRoomId(decor) {
      if (!(decor.meta.gmId >= 0 && decor.meta.roomId >= 0)) {
        const decorOrigin = state.getDecorOrigin(decor);
        const gmRoomId = w.gmGraph.findRoomContaining(decorOrigin);
        if (gmRoomId) {
          Object.assign(decor.meta, gmRoomId);
        } else {
          throw new Error(`decor origin must reside in some room: ${JSON.stringify(decor)}`);
        }
      }
      return decor.meta;
    },
    getDecorOrigin(decor) {
      switch (decor.type) {
        case 'circle':
        case 'cuboid':
        case 'poly':
          return decor.center;
        case 'point':
          return decor;
        default:
          throw testNever(decor);
      }
    },
    instantiateGmDecor(gmId, gm) {
      // 🔔 update on dynamic nav-mesh
      state.byRoom[gmId] ??= gm.rooms.map(_ => ({ decor: {}, points: [], colliders: [] }));
      
      /** @type {Geomorph.Decor[]} */
      const ds = gm.decor.map((def, localDecorId) => {
        const base = {
          key: `g${gmId}dec${localDecorId}`,
          meta: { ...def.meta, gmId },
          bounds2d: tmpRect1.copy(def.bounds2d).applyMatrix(gm.matrix).json,
        };
        switch (def.type) {
          case 'circle':
            return { ...def, ...base,
              center: gm.matrix.transformPoint({ ...def.center }),
            };
          case "cuboid":
            const center = gm.matrix.transformPoint({ x: def.center.x, y: def.center.z });
            const extent = gm.matrix.transformSansTranslate({ x: def.extent.x, y: def.extent.z });
            return { ...def, ...base,
              center: { x: center.x, y: def.center.y, z: center.y },
              extent: { x: extent.x, y: def.extent.y, z: extent.y },
            };
          case "point":
            return gm.matrix.transformPoint({ ...def, ...base });
          case "poly":
            return { ...def, ...base,
              center: gm.matrix.transformPoint({ ...def.center }),
              points: def.points.map(p => gm.matrix.transformPoint({ ...p })),
            };
          default:
            throw testNever(def);
        }
      });
      state.addDecor(ds);
    },
    onPointerDown(e) {
      // 🚧
    },
    onPointerUp(e) {
      // 🚧
    },
    positionDecor() { 
      // decor cuboids
      const { cuboidInst } = state;
      let cuboidId = 0;
      
      for (const d of Object.values(state.decor)) {
        if (d.type === 'cuboid') {
          const mat4 = state.createCuboidMatrix4(d);
          cuboidInst.setMatrixAt(cuboidId++, mat4);
        }
        // 🚧 decor quads
      }

      cuboidInst.instanceMatrix.needsUpdate = true;
      cuboidInst.computeBoundingSphere();
    },
    removeDecor(...decorKeys) {
      const ds = decorKeys.map(x => state.decor[x]).filter(Boolean);

      const grouped = ds.reduce((agg, d) => {
        const { gmId, roomId } = d.meta;
        (agg[geomorphService.getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, ds: [] }).ds.push(d);
        return agg;
      }, /** @type {Record<`g${number}r${number}`, Geomorph.GmRoomId & { ds: Geomorph.Decor[] }>} */ ({}));

      for (const { gmId, roomId, ds } of Object.values(grouped)) {
        state.removeRoomDecor(gmId, roomId, ds)
      }

      update();
    },
    removeRoomDecor(gmId, roomId, ds) {
      if (ds.length === 0) {
        return;
      }
      const atRoom = state.byRoom[gmId][roomId];

      for (const d of ds) {
        if (!(d.key in state.decor)) {
          continue;
        }
        delete state.decor[d.key];
        delete atRoom.decor[d.key];
        // 🔔 not every non-cuboid has associated quad?
        d.type === 'cuboid' ? state.cuboidCount-- : state.quadCount--;
      }

      const points = ds.filter(geomorphService.isDecorPoint);
      atRoom.points = atRoom.points.filter(d => !points.includes(d));
      points.forEach(d => removeFromDecorGrid(d, state.byGrid));
      const colliders = ds.filter(geomorphService.isDecorCollidable);
      atRoom.colliders = atRoom.colliders.filter(d => !colliders.includes(d));
      colliders.forEach(d => removeFromDecorGrid(d, state.byGrid));

      w.events.next({ key: 'decors-removed', decors: ds });
    },
  }));

  w.decor = state;

  useQuery({
    queryKey: ['decor', w.key, w.decorHash],
    async queryFn() {
      // initialize decor
      for (const [gmId, gm] of w.gms.entries()) {
        await pause();
        state.instantiateGmDecor(gmId, gm);
      }
      return w.decorHash; // trigger useEffect
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  React.useEffect(() => {
    state.addQuadUvs();
    state.positionDecor();
  }, [w.hash, state.cuboidCount, state.quadCount]);

  const update = useUpdate();

  return <>
    <instancedMesh
      name="decor-cuboids"
      key={`${w.hash} ${state.cuboidCount} cuboids`}
      ref={instances => instances && (state.cuboidInst = instances)}
      args={[boxGeometry, undefined, state.cuboidCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      {/* <meshBasicMaterial color="red" /> */}
      <meshDiffuseTestMaterial
        key={glsl.MeshDiffuseTestMaterial.key}
        side={THREE.DoubleSide} // fix flipped gm
        diffuse={[0.35, 0.25, 0.25]}
      />
    </instancedMesh>

    <instancedMesh
      name="decor-quads"
      key={`${w.hash} ${state.quadCount} quads`}
      ref={instances => instances && (state.quadInst = instances)}
      // 🚧
      // args={[quadGeometryXZ, undefined, state.quadCount]}
      args={[quadGeometryXZ, undefined, 0]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        map={w.decorTex}
        transparent
      />
    </instancedMesh>
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {Geomorph.DecorGrid} byGrid
 * PoCollidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {Record<string, Geomorph.Decor>} decor
 * @property {number} cuboidCount Total number of decor cuboids
 * @property {number} quadCount Total number of decor quads
 * @property {THREE.InstancedMesh} quadInst
 * @property {number} nextDecorCid
 *
 * @property {(ds: Geomorph.Decor[]) => void} addDecor
 * @property {() => void} addQuadUvs
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} addRoomDecor
 * @property {(d: Geomorph.DecorCuboid) => THREE.Matrix4} createCuboidMatrix4
 * @property {(d: Geomorph.Decor) => Geomorph.GmRoomId} ensureGmRoomId
 * @property {(d: Geomorph.Decor) => Geom.VectJson} getDecorOrigin
 * @property {(gmId: number, gm: Geomorph.LayoutInstance) => void} instantiateGmDecor
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionDecor
 * @property {(...decorKeys: string[]) => void} removeDecor
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} removeRoomDecor
 */
