import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { pause, testNever, warn } from "../service/generic";
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
    byKey: {},
    byGrid: [],
    byRoom: [],
    cuboids: [],
    cuboidInst: /** @type {*} */ (null),
    quads: [],
    quadInst: /** @type {*} */ (null),

    addDecor(ds, removeExisting = true) {

      const addable = ds.reduce((agg, d) => {
        if (state.ensureGmRoomId(d) !== null) agg.push(d);
        else warn(`decor "${d.key}" cannot be added: not in any room`, d);
        return agg;
      }, /** @type {Geomorph.Decor[]} */ ([]));

      const grouped = addable.reduce((agg, d) => {
        (agg[d.meta.grKey] ??= { meta: d.meta, add: [], remove: [] }).add.push(d);
        
        const prev = state.byKey[d.key];
        if (prev !== undefined) {// Add pre-existing decor to removal group
          d.updatedAt = Date.now();
          (agg[prev.meta.grKey] ??= { meta: prev.meta, add: [], remove: [] }).remove.push(prev);
        }

        return agg;
      }, /** @type {Record<`g${number}r${number}`, { meta: Geom.Meta<Geomorph.GmRoomId> } & { [x in 'add' | 'remove']: Geomorph.Decor[] }>} */ ({}));

      removeExisting && Object.values(grouped).forEach(({ meta, remove }) =>
        state.removeDecorFromRoom(meta.gmId, meta.roomId, remove)
      );

      Object.values(grouped).forEach(({ meta, add }) =>
        state.addDecorToRoom(meta.gmId, meta.roomId, add)
      );

      state.cuboids = Object.values(state.byKey).filter(d => d.type === 'cuboid');
      state.quads = Object.values(state.byKey).filter(d => d.meta.decorImgKey); // 🚧 d.decorImgKey
      update();
    },
    addDecorToRoom(gmId, roomId, ds) {
      const atRoom = state.byRoom[gmId][roomId];

      for (const d of ds) {
        if (d.key in state.byKey) {
          continue;
        }
        addToDecorGrid(d, state.byGrid);
        state.byKey[d.key] = d;
        atRoom.add(d);
      }

      ds.length && w.events.next({ key: 'decors-added', decors: ds });
    },
    addQuadUvs() {
      // 🚧
    },
    createCuboidMatrix4(cuboidDecor) {
      tmpMat1.feedFromArray([
        cuboidDecor.extent.x * 2, 0, 0, cuboidDecor.extent.z * 2,
        cuboidDecor.center.x, cuboidDecor.center.z,
      ]);
      return geomorphService.embedXZMat4(tmpMat1.toArray(), {
        mat4: tmpMatFour1,
        yHeight: cuboidDecor.center.y,
        yScale: cuboidDecor.extent.y * 2,
      });
    },
    detectClick(e) {
      // 🚧 decor quad may require detect non-transparent pixel in decor sprite-sheet
      const instanceId = /** @type {number} */ (e.instanceId);
      const byInstId = e.object.name === 'decor-cuboids' ? state.cuboids : state.quads;
      return byInstId[instanceId];
      
      // const { gmId, obstacleId } = state.decodeObstacleId(instanceId);
      // const gm = w.gms[gmId];
      // const obstacle = gm.obstacles[obstacleId];
      
      // // transform 3D point back to unit XZ quad
      // const mat4 = state.createObstacleMatrix4(gm.transform, obstacle).invert();
      // const unitQuadPnt = e.point.clone().applyMatrix4(mat4);
      // // transform unit quad point into spritesheet
      // const meta = w.geomorphs.sheet.obstacle[`${obstacle.symbolKey} ${obstacle.obstacleId}`];
      // const sheetX = Math.floor(meta.x + unitQuadPnt.x * meta.width);
      // const sheetY = Math.floor(meta.y + unitQuadPnt.z * meta.height);

      // const canvas = /** @type {HTMLCanvasElement} */ (w.obsTex.image);
      // const ctxt = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      // const { data: rgba } = ctxt.getImageData(sheetX, sheetY, 1, 1, { colorSpace: 'srgb' });
      // // console.log(rgba, { obstacle, point3d: e.point, unitQuadPnt, sheetX, sheetY });
      
      // // ignore clicks on fully transparent pixels
      // return rgba[3] === 0 ? null : { gmId, obstacleId, obstacle };
    },
    ensureGmRoomId(decor) {
      if (!(decor.meta.gmId >= 0 && decor.meta.roomId >= 0)) {
        const decorOrigin = state.getDecorOrigin(decor);
        const gmRoomId = w.gmGraph.findRoomContaining(decorOrigin);
        if (gmRoomId) {
          return Object.assign(decor.meta, gmRoomId);
        } else {
          // throw new Error(`decor origin must reside in some room: ${JSON.stringify(decor)}`);
          return null;
        }
      } else {
        decor.meta.grKey ??= geomorphService.getGmRoomKey(decor.meta.gmId, decor.meta.roomId);
        return decor.meta;
      }
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
    instantiateDecorKey(d) {
      // 🔔 assume distinct geomorph decor have distinct "min point of 3D AABB"
      return `g${d.meta.gmId}r${d.meta.roomId}[${d.bounds2d.x},${d.type === 'cuboid' ? d.center.y : 0},${d.bounds2d.y}]`;
    },
    initializeGmDecor(gmId, gm) {
      // 🔔 needs update on dynamic nav-mesh
      state.byRoom[gmId] ??= gm.rooms.map(_ => new Set());
      
      /** @type {Geomorph.Decor[]} */
      const ds = gm.decor.map((def, localId) => {
        def.meta.gmId = gmId;
        const base = {
          key: state.instantiateDecorKey(def),
          meta: { ...def.meta, gmId, localId },
          bounds2d: tmpRect1.copy(def.bounds2d).applyMatrix(gm.matrix).json,
          src: gm.key,
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

      state.addDecor(ds, false); // We already removed existing
    },
    onPointerDown(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const decor = state.detectClick(e);

      if (decor !== null) {
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerdown",
          distancePx: 0,
          event: e,
          is3d: true,
          justLongDown: false,
          meta: {
            decor: true,
            ...decor.meta,
            instanceId,
          },
        }));
        e.stopPropagation();
      }
    },
    onPointerUp(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const decor = state.detectClick(e);

      if (decor !== null) {
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerup",
          event: e,
          is3d: true,
          meta: {
            decor: true,
            ...decor.meta,
            instanceId,
          },
        }));
        e.stopPropagation();
      }
    },
    positionInstances() { 
      // decor cuboids
      const { cuboidInst } = state;
      
      for (const [instId, d] of state.cuboids.entries()) {
        if (d.type === 'cuboid') {
          const mat4 = state.createCuboidMatrix4(d);
          cuboidInst.setMatrixAt(instId, mat4);
        }
      }
      // 🚧 decor quads

      cuboidInst.instanceMatrix.needsUpdate = true;
      cuboidInst.computeBoundingSphere();
    },
    removeDecor(...decorKeys) {
      const ds = decorKeys.map(x => state.byKey[x]).filter(Boolean);

      const grouped = ds.reduce((agg, d) => {
        (agg[d.meta.grKey] ??= { meta: d.meta, ds: [] }).ds.push(d);
        return agg;
      }, /** @type {Record<`g${number}r${number}`, { meta: Geom.Meta<Geomorph.GmRoomId> } & { ds: Geomorph.Decor[] }>} */ ({}));

      for (const { meta, ds } of Object.values(grouped)) {
        state.removeDecorFromRoom(meta.gmId, meta.roomId, ds)
      }

      state.cuboids = Object.values(state.byKey).filter(d => d.type === 'cuboid');
      state.quads = Object.values(state.byKey).filter(d => d.meta.decorImgKey); // 🚧 d.decorImgKey
      update();
    },
    removeDecorFromRoom(gmId, roomId, ds) {
      if (ds.length === 0) {
        return;
      }

      const atRoom = state.byRoom[gmId][roomId];

      for (const d of ds) {
        if (!(d.key in state.byKey)) {
          continue;
        }
        delete state.byKey[d.key];
        atRoom.delete(d);
      }

      ds.forEach(d => removeFromDecorGrid(d, state.byGrid));

      w.events.next({ key: 'decors-removed', decors: ds });
    },
    removeInstantiatedDecor() {
      for (const d of Object.values(state.byKey)) {
        d.src !== undefined && delete state.byKey[d.key];
      }
      for (const byRoomId of state.byRoom) {
        for (const decorSet of byRoomId) {
          decorSet.forEach(d => d.src !== undefined && decorSet.delete(d));
        }
      }
      for (const byY of state.byGrid) {
        for (const decorSet of byY) {
          decorSet.forEach(d => d.src !== undefined && decorSet.delete(d));
        }
      }
    },
  }));

  w.decor = state;

  useQuery({
    queryKey: ['decor', w.key, w.decorHash],
    async queryFn() {// initialize decor
      if (Object.values(state.byKey).length) { 
        await pause();
        state.removeInstantiatedDecor();
      }

      for (const [gmId, gm] of w.gms.entries()) {
        await pause();
        state.initializeGmDecor(gmId, gm);
      }
      return w.decorHash; // trigger useEffect
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  React.useEffect(() => {
    state.addQuadUvs();
    state.positionInstances();
  }, [w.hash, state.cuboids.length, state.quads.length]);

  const update = useUpdate();

  return <>
    <instancedMesh
      name="decor-cuboids"
      key={`${w.hash} ${state.cuboids.length} cuboids`}
      ref={instances => instances && (state.cuboidInst = instances)}
      args={[boxGeometry, undefined, state.cuboids.length]}
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
      key={`${w.hash} ${state.quads.length} quads`}
      ref={instances => instances && (state.quadInst = instances)}
      // 🚧
      // args={[quadGeometryXZ, undefined, state.byQuadId.length]}
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
 * @property {Geomorph.Decor[]} cuboids
 * @property {Geomorph.DecorGrid} byGrid
 * PoCollidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {Record<string, Geomorph.Decor>} byKey
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {Geomorph.Decor[]} quads This is `Object.values(state.byKey)`
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {THREE.InstancedMesh} quadInst
 *
 * @property {(ds: Geomorph.Decor[], removeExisting?: boolean) => void} addDecor
 * Can manually `removeExisting` e.g. during re-instantiation of geomorph decor
 * @property {() => void} addQuadUvs
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} addDecorToRoom
 * @property {(d: Geomorph.DecorCuboid) => THREE.Matrix4} createCuboidMatrix4
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => null | Geomorph.Decor} detectClick
 * @property {(d: Geomorph.Decor) => Geomorph.GmRoomId | null} ensureGmRoomId
 * @property {(d: Geomorph.Decor) => Geom.VectJson} getDecorOrigin
 * @property {(d: Geomorph.Decor) => `g${number}r${number}[${number},${number},${number}]`} instantiateDecorKey
 * @property {(gmId: number, gm: Geomorph.LayoutInstance) => void} initializeGmDecor
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionInstances
 * @property {(...decorKeys: string[]) => void} removeDecor
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} removeDecorFromRoom
 * @property {() => void} removeInstantiatedDecor
 */
