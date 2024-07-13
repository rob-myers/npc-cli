import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { decorGridSize, decorIconRadius } from "../service/const";
import { hashJson, mapValues, pause, testNever, warn } from "../service/generic";
import { tmpMat1, tmpRect1 } from "../service/geom";
import { geomorphService } from "../service/geomorph";
import { addToDecorGrid, removeFromDecorGrid } from "../service/grid";
import { boxGeometry, getQuadGeometryXZ, tmpMatFour1 } from "../service/three";
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
    hash : /** @type {State['hash']} */ ({ mapHash: 0 }),
    quads: [],
    quadGeom: getQuadGeometryXZ(`${w.key}-decor-xz`),
    quadInst: /** @type {*} */ (null),
    rmKeys: new Set(),

    addDecor(ds, removeExisting = true) {

      const addable = ds.filter((d) => state.ensureGmRoomId(d) !== null ||
        void warn(`decor "${d.key}" cannot be added: not in any room`, d)
      );

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

      if (addable.length) {
        state.updateInstanceLists();
        w.events.next({ key: 'decors-added', decors: ds });
      }
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
        state.rmKeys.delete(d.key);
      }
    },
    addQuadUvs() {
      const { decor: sheet, decorDim: sheetDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      
      const item = sheet['icon--001--info']; // 🚧 remove hard-coding
      for (const d of state.quads) {
        const { x, y, width, height } = item;
        uvOffsets.push(x / sheetDim.width,  y / sheetDim.height);
        uvDimensions.push(width / sheetDim.width, height / sheetDim.height);
      }

      state.quadInst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.quadInst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
    },
    computeNextHash() {
      const { layout } = w.geomorphs;
      return {
        mapHash: hashJson(w.geomorphs.map[w.mapKey]),
        ...mapValues(geomorphService.toGmNum, (_, gmKey) => 
          hashJson(layout[gmKey].decor)
        ),
      };
    },
    createCuboidMatrix4(cuboidDecor) {
      if (cuboidDecor.angle !== 0) {
        tmpMat1.feedFromArray([cuboidDecor.extent.x * 2, 0, 0, cuboidDecor.extent.z * 2, 0, 0])
          .postMultiply([Math.cos(cuboidDecor.angle), Math.sin(cuboidDecor.angle), -Math.sin(cuboidDecor.angle), Math.cos(cuboidDecor.angle), 0, 0,])
          .translate(cuboidDecor.center.x, cuboidDecor.center.z);
      } else {
        tmpMat1.feedFromArray([
          cuboidDecor.extent.x * 2, 0, 0, cuboidDecor.extent.z * 2,
          cuboidDecor.center.x, cuboidDecor.center.z,
        ]);
      }
      return geomorphService.embedXZMat4(tmpMat1.toArray(), {
        mat4: tmpMatFour1,
        yHeight: cuboidDecor.center.y,
        yScale: cuboidDecor.extent.y * 2,
      });
    },
    createQuadMatrix4(d) {
      if (d.type === 'point') {// move to center and scale
        tmpMat1.feedFromArray([
          decorIconRadius * 2, 0, 0, decorIconRadius * 2, d.x - decorIconRadius, d.y - decorIconRadius
        ]);
        return geomorphService.embedXZMat4(tmpMat1.toArray(), {
          mat4: tmpMatFour1,
          yHeight: d.meta.y || 0.01, // 🚧 default point height > 0
        });
      } else {// 🚧 assume rotated rect
        const [p, q, r, s] = d.points;
        tmpMat1.feedFromArray([
          q.x - p.x, q.y - p.y, s.x - p.x, s.y - p.y, p.x, p.y,
        ]);
        return geomorphService.embedXZMat4(tmpMat1.toArray(), {
          mat4: tmpMatFour1,
          yHeight: d.meta.y ?? 2, // 🚧 default poly height
        });
      }
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
        return gmRoomId === null ? null : Object.assign(decor.meta, gmRoomId);
      } else {
        decor.meta.grKey ??= geomorphService.getGmRoomKey(decor.meta.gmId, decor.meta.roomId);
        return decor.meta;
      }
    },
    getDecorOrigin(decor) {
      return decor.type === 'point' ? decor : decor.center;
    },
    instantiateDecor(gmId, gm) {
      state.byRoom[gmId] ??= gm.rooms.map(_ => new Set()); // 🔔 needs update on dynamic nav
      
      /** @type {Geomorph.Decor[]} */ ([]);
      const ds = gm.decor.map((def, localId) => {
        /** @type {Geomorph.Decor} */ let out;
        const base = {
          key: '', // must compute after apply transform
          meta: { ...def.meta, gmId, localId },
          bounds2d: tmpRect1.copy(def.bounds2d).applyMatrix(gm.matrix).json,
          src: gm.key,
        };

        switch (def.type) {
          case 'circle':
            out = { ...def, ...base,
              center: gm.matrix.transformPoint({ ...def.center }),
            };
            break;
          case "cuboid":
            const center = gm.matrix.transformPoint({ x: def.center.x, y: def.center.z });
            const extent = gm.matrix.transformSansTranslate({ x: def.extent.x, y: def.extent.z });
            out = { ...def, ...base,
              center: { x: center.x, y: def.center.y, z: center.y },
              extent: { x: extent.x, y: def.extent.y, z: extent.y },
            };
            break;
          case "point":
            out = gm.matrix.transformPoint({ ...def, ...base });
            break;
          case "poly":
            out = { ...def, ...base,
              center: gm.matrix.transformPoint({ ...def.center }),
              points: def.points.map(p => gm.matrix.transformPoint({ ...p })),
            };
            break;
          default:
            throw testNever(def);
        }
        out.key = geomorphService.getDerivedDecorKey(out);
        return out;
      }).filter(d =>
        // Don't re-instantiate explicitly removed
        !state.rmKeys.has(d.key) && (d.meta.roomId >= 0 ||
          warn(`decor "${d.key}" cannot be instantiated: not in any room`, d)
        )
      );

      state.addDecor(ds, false); // Already removed existing
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
      const { cuboidInst, quadInst } = state;
      
      for (const [instId, d] of state.cuboids.entries()) {
        const mat4 = state.createCuboidMatrix4(d);
        cuboidInst.setMatrixAt(instId, mat4);
      }
      
      for (const [instId, d] of state.quads.entries()) {
        const mat4 = state.createQuadMatrix4(d);
        quadInst.setMatrixAt(instId, mat4);
      }

      cuboidInst.instanceMatrix.needsUpdate = true;
      cuboidInst.computeBoundingSphere();
      quadInst.instanceMatrix.needsUpdate = true;
      quadInst.computeBoundingSphere();
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

      if (ds.length) {
        state.updateInstanceLists();
        w.events.next({ key: 'decors-removed', decors: ds });
      }
    },
    removeDecorFromRoom(gmId, roomId, ds) {
      const atRoom = state.byRoom[gmId][roomId];

      for (const d of ds) {
        if (!(d.key in state.byKey)) {
          continue;
        }
        delete state.byKey[d.key];
        atRoom.delete(d);
        state.rmKeys.add(d.key);
      }

      ds.forEach(d => removeFromDecorGrid(d, state.byGrid));
    },
    rmInstantiatedDecor(gmId) {
      const byRoomId = state.byRoom[gmId];
      for (const decorSet of byRoomId) {
        decorSet.forEach(d => d.src !== undefined &&
          decorSet.delete(d) && delete state.byKey[d.key]
        );
      }
      // clear gmId's part of the decor grid
      const { gridRect } = w.gms[gmId];
      const { x, right, y, bottom } = tmpRect1.copy(gridRect).scale(1 / decorGridSize).integerOrds();
      // console.log({ x, right, y, bottom })
      for (let i = x; i < right; i++) {
        const inner = state.byGrid[i];
        if (inner === undefined) continue;
        for (let j = y; j < bottom; j++) inner[j]?.clear();
      }
    },
    updateInstanceLists() {// 🚧 WIP
      state.cuboids = Object.values(state.byKey).filter(
        /** @returns {d is Geomorph.DecorCuboid} */
        d => d.type === 'cuboid'
      );
      state.quads = Object.values(state.byKey).filter(// 🚧 WIP
        /** @returns {d is Geomorph.DecorPoint} */
        d => d.type === 'point'
      );
      update();
    },
  }));

  w.decor = state;

  // instantiate geomorph decor
  // 🚧 recompute on hmr
  const { status: queryStatus } = useQuery({
    queryKey: ['decor', w.key, w.decorHash],
    async queryFn() {
      const prev = state.hash;
      const next = state.computeNextHash();
      /** current map changed */
      const redoAll = prev.mapHash !== next.mapHash;

      for (const [gmId, gm] of w.gms.entries()) {
        if (!redoAll && prev[gm.key] === next[gm.key]) {
          continue;
        }
        if (state.byRoom[gmId] !== undefined) {
          await pause();
          state.rmInstantiatedDecor(gmId);
        }
        
        await pause();
        state.instantiateDecor(gmId, gm);
      }

      state.hash = next;
      update();
      return null;
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  React.useEffect(() => {
    if (queryStatus === 'success') {
      state.addQuadUvs();
      state.positionInstances();
    }
  }, [queryStatus, state.cuboids.length, state.quads.length]);

  const update = useUpdate();

  return <>
    <instancedMesh
      name="decor-cuboids"
      key={`${state.cuboids.length} cuboids`}
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
      key={`${state.quads.length} quads`}
      ref={instances => instances && (state.quadInst = instances)}
      args={[state.quadGeom, undefined, state.quads.length]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      {/* <meshBasicMaterial color="red" /> */}
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        map={w.decorTex}
        transparent
        // diffuse={new THREE.Vector3(0.6, 0.6, 0.6)}
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
 * @property {Geomorph.DecorCuboid[]} cuboids
 * @property {Geomorph.DecorGrid} byGrid
 * PoCollidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {Record<string, Geomorph.Decor>} byKey
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {(Geomorph.DecorPoint | Geomorph.DecorPoly)[]} quads This is `Object.values(state.byKey)`
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {{ mapHash: number; } & Record<Geomorph.GeomorphKey, number>} hash
 * If any decor changed in a geomorph, re-instantiate all
 * @property {THREE.BufferGeometry} quadGeom
 * @property {THREE.InstancedMesh} quadInst
 * @property {Set<string>} rmKeys decorKeys manually removed via `removeDecorFromRoom`,
 * but yet added back in. This is useful e.g. so can avoid re-instantiating geomorph decor
 *
 * @property {(ds: Geomorph.Decor[], removeExisting?: boolean) => void} addDecor
 * Can manually `removeExisting` e.g. during re-instantiation of geomorph decor
 * @property {() => void} addQuadUvs
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} addDecorToRoom
 * @property {() => State['hash']} computeNextHash
 * @property {(d: Geomorph.DecorCuboid) => THREE.Matrix4} createCuboidMatrix4
 * @property {(d: Geomorph.DecorPoint | Geomorph.DecorPoly) => THREE.Matrix4} createQuadMatrix4
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => null | Geomorph.Decor} detectClick
 * @property {(d: Geomorph.Decor) => Geomorph.GmRoomId | null} ensureGmRoomId
 * @property {(d: Geomorph.Decor) => Geom.VectJson} getDecorOrigin
 * @property {(gmId: number, gm: Geomorph.LayoutInstance) => void} instantiateDecor
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionInstances
 * @property {(...decorKeys: string[]) => void} removeDecor
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} removeDecorFromRoom
 * @property {(gmId: number) => void} rmInstantiatedDecor
 * @property {() => void} updateInstanceLists
 */
