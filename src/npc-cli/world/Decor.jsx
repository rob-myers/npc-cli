import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { decorGridSize, decorIconRadius, gmLabelHeightSgu, sguToWorldScale, spriteSheetDecorExtraScale, spriteSheetLabelExtraScale, wallHeight } from "../service/const";
import { hashJson, mapValues, pause, removeDups, testNever, warn } from "../service/generic";
import { tmpMat1, tmpRect1 } from "../service/geom";
import { geomorphService } from "../service/geomorph";
import { addToDecorGrid, removeFromDecorGrid } from "../service/grid";
import { boxGeometry, getQuadGeometryXZ, tmpMatFour1 } from "../service/three";
import * as glsl from "../service/glsl";
import packRectangles from "../service/rects-packer";
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
    labels: [],
    labelInst: /** @type {*} */ (null),
    label: {
      hash: 0,
      quad: getQuadGeometryXZ(`${w.key}-labels-xz`),
      sheet: {},
      tex: new THREE.CanvasTexture(document.createElement('canvas')),
    },
    quads: [],
    quadGeom: getQuadGeometryXZ(`${w.key}-decor-xz`),
    quadInst: /** @type {*} */ (null),
    queryStatus: 'pending',
    rmKeys: new Set(),
    showLabels: false,

    addDecor(ds, removeExisting = true) {
      const addable = ds.filter((d) => state.ensureGmRoomId(d) !== null ||
        void warn(`decor "${d.key}" cannot be added: not in any room`, d)
      );
      if (addable.length === 0) {
        return;
      }

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

      state.updateDecorLists();
      w.events.next({ key: 'decors-added', decors: ds });
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
        state.rmKeys.delete(d.key);
      }
    },
    addLabelUvs() {
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const { quad, sheet, tex } = state.label;
      const { width: sheetWidth, height: sheetHeight } = /** @type {HTMLCanvasElement} */ (tex.image);

      for (const d of state.labels) {
        const { x, y, width, height } = sheet[d.meta.label];
        uvOffsets.push(x / sheetWidth, y / sheetHeight);
        uvDimensions.push(width / sheetWidth, height / sheetHeight);
      }

      quad.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      quad.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
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
    computeHash() {
      const { layout } = w.geomorphs;
      const map = w.geomorphs.map[w.mapKey];
      return {
        mapHash: hashJson(map),
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
    createLabelMatrix4(d) {
      const { width, height } = state.label.sheet[d.meta.label];
      const scale = sguToWorldScale * (1 / spriteSheetLabelExtraScale);
      tmpMat1.feedFromArray([
        width * scale, 0, 0, height * scale,
        d.x - (width * scale) / 2,
        d.y - (height * scale) / 2,
      ]);
      return geomorphService.embedXZMat4(tmpMat1.toArray(), {
        mat4: tmpMatFour1,
        yHeight: wallHeight + 0.1,
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
        return gmRoomId === null ? null : Object.assign(decor.meta, gmRoomId);
      } else {
        decor.meta.grKey ??= geomorphService.getGmRoomKey(decor.meta.gmId, decor.meta.roomId);
        return decor.meta;
      }
    },
    ensureLabelSheet() {
      // Avoid needless recompute
      const labels = removeDups(Array.from(state.labels.map(x => /** @type {string} */ (x.meta.label)))).sort();
      const hash = hashJson(labels);
      if (hash === state.label.hash) {
        return;
      }
      state.label.hash = hash;
      
      // Create sprite-sheet
      const canvas = /** @type {HTMLCanvasElement} */ (state.label.tex.image);
      const ct = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;

      ct.font = `${fontHeight}px 'Courier new'`;
      /** @type {import("../service/rects-packer").PrePackedRect<{ label: string }>[]} */
      const rects = labels.map(label => ({
        width: ct.measureText(label).width,
        height: fontHeight,
        data: { label },
      }));
      const bin = packRectangles(rects, { logPrefix: 'w.ensureLabelSheet', packedPadding: 2 });
      state.label.sheet = bin.rects.reduce((agg, r) => {
        agg[r.data.label] = { x: r.x, y: r.y, width: r.width, height: r.height };
        return agg;
      }, /** @type {LabelsMeta['sheet']} */ ({}));
      
      // Draw sprite-sheet
      if (canvas.width !== bin.width || canvas.height !== bin.height) {
        state.label.tex.dispose();
        [canvas.width, canvas.height] = [bin.width, bin.height];
        state.label.tex = new THREE.CanvasTexture(canvas);
        state.label.tex.flipY = false;
      }
      ct.clearRect(0, 0, bin.width, bin.height);
      ct.strokeStyle = ct.fillStyle = 'white';
      ct.font = `${fontHeight}px 'Courier new'`;
      ct.textBaseline = 'top';
      bin.rects.forEach(rect => {
        ct.fillText(rect.data.label, rect.x, rect.y);
        ct.strokeText(rect.data.label, rect.x, rect.y);
      });
      state.label.tex.needsUpdate = true;
    },
    getDecorOrigin(decor) {
      return decor.type === 'point' ? decor : decor.center;
    },
    instantiateDecor(d, gmId, gm) {
      /** @type {Geomorph.Decor} */
      let instance;
      /** @type {Geomorph.BaseDecor} */
      const base = {
        key: '', // must compute after apply transform
        meta: { ...d.meta, gmId },
        bounds2d: tmpRect1.copy(d.bounds2d).applyMatrix(gm.matrix).json,
        src: gm.key,
      };

      switch (d.type) {
        case 'circle':
          instance = { ...d, ...base,
            center: gm.matrix.transformPoint({ ...d.center }),
          };
          break;
        case "cuboid":
          const center = gm.matrix.transformPoint({ x: d.center.x, y: d.center.z });
          const extent = gm.matrix.transformSansTranslate({ x: d.extent.x, y: d.extent.z });
          instance = { ...d, ...base,
            center: { x: center.x, y: d.center.y, z: center.y },
            extent: { x: extent.x, y: d.extent.y, z: extent.y },
          };
          break;
        case "point":
          instance = gm.matrix.transformPoint(/** @type {Geomorph.DecorPoint} */ ({ ...d, ...base }));
          break;
        case "poly":
          instance = { ...d, ...base,
            center: gm.matrix.transformPoint({ ...d.center }),
            points: d.points.map(p => gm.matrix.transformPoint({ ...p })),
          };
          break;
        default:
          throw testNever(d);
      }
      instance.key = geomorphService.getDerivedDecorKey(instance);
      return /** @type {typeof d} */ (instance);
    },
    instantiateGmDecor(gmId, gm) {
      state.addDecor(gm.decor.map(d => state.instantiateDecor(d, gmId, gm))
        // Don't re-instantiate explicitly removed
        .filter(d => !state.rmKeys.has(d.key) && (d.meta.roomId >= 0 ||
          warn(`decor "${d.key}" cannot be instantiated: not in any room`, d)
        )
      ), false);
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
      const { cuboidInst, quadInst, labelInst } = state;
      
      for (const [instId, d] of state.cuboids.entries()) {
        const mat4 = state.createCuboidMatrix4(d);
        cuboidInst.setMatrixAt(instId, mat4);
      }
      
      for (const [instId, d] of state.quads.entries()) {
        const mat4 = state.createQuadMatrix4(d);
        quadInst.setMatrixAt(instId, mat4);
      }

      for (const [instId, d] of state.labels.entries()) {
        const mat4 = state.createLabelMatrix4(d);
        labelInst.setMatrixAt(instId, mat4);
      }
    
      cuboidInst.instanceMatrix.needsUpdate = true;
      cuboidInst.computeBoundingSphere();
      quadInst.instanceMatrix.needsUpdate = true;
      quadInst.computeBoundingSphere();
      labelInst.instanceMatrix.needsUpdate = true;
      labelInst.computeBoundingSphere();
    },
    removeDecor(...decorKeys) {
      const ds = decorKeys.map(x => state.byKey[x]).filter(Boolean);
      if (ds.length === 0) {
        return;
      }

      const grouped = ds.reduce((agg, d) => {
        (agg[d.meta.grKey] ??= { meta: d.meta, ds: [] }).ds.push(d);
        return agg;
      }, /** @type {Record<`g${number}r${number}`, { meta: Geom.Meta<Geomorph.GmRoomId> } & { ds: Geomorph.Decor[] }>} */ ({}));

      for (const { meta, ds } of Object.values(grouped)) {
        state.removeDecorFromRoom(meta.gmId, meta.roomId, ds)
      }

      state.updateDecorLists();
      w.events.next({ key: 'decors-removed', decors: ds });
      update();
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
    removeAllInstantiated() {
      for (const d of Object.values(state.byKey)) {
        d.src !== undefined && delete state.byKey[d.key];
      }
      for (const byRoomId of state.byRoom) {
        for (const decorSet of byRoomId) {
          decorSet.forEach(d => d.src !== undefined && decorSet.delete(d));
        }
      }
      for (const byY of state.byGrid) {
        for (const decorSet of byY ?? []) {
          // array can contain `undefined` (untouched by decor)
          decorSet?.forEach(d => d.src !== undefined && decorSet.delete(d));
        }
      }
    },
    removeInstantiated(gmId) {
      const byRoomId = state.byRoom[gmId];
      for (const ds of byRoomId) {
        ds.forEach(d => d.src !== undefined && ds.delete(d) && delete state.byKey[d.key]);
      }
      const { gridRect } = w.gms[gmId]; // clear gmId's part of the decor grid
      const { x, right, y, bottom } = tmpRect1.copy(gridRect).scale(1 / decorGridSize).integerOrds();
      for (let i = x; i < right; i++) {
        const inner = state.byGrid[i];
        if (inner === undefined) continue;
        for (let j = y; j < bottom; j++) {
          inner[j]?.forEach(d => d.src !== undefined && inner[j].delete(d));
        }
      }
    },
    updateDecorLists() {
      state.cuboids = Object.values(state.byKey).filter(
        geomorphService.isDecorCuboid
      );

      // 🔔 currently only support decor points "do" and "button"
      state.quads = Object.values(state.byKey).filter(
        /** @returns {x is Geomorph.DecorPoint} */
        x => x.type === 'point' && (x.meta.do === true || x.meta.button === true)
      );
    },
  }));

  w.decor = state;
  
  state.queryStatus = useQuery({// instantiate geomorph decor
    queryKey: ['decor', w.key, w.decorHash],
    async queryFn() {

      const prev = state.hash;
      const next = state.computeHash();
      const mapChanged = prev.mapHash !== next.mapHash;

      state.labels = w.gms.flatMap((gm, gmId) => gm.labels.map(d => state.instantiateDecor(d, gmId, gm)));
      state.ensureLabelSheet();
      state.addLabelUvs();

      if (mapChanged) {
        // Re-instantiate all cleanly
        state.removeAllInstantiated();
        w.gms.forEach((gm, gmId) => {
          state.byRoom[gmId] ??= gm.rooms.map(_ => new Set());
          gm.rooms.forEach((_, roomId) => state.byRoom[gmId][roomId] ??= new Set());
        });
        await pause();

        for (const [gmId, gm] of w.gms.entries()) {
          state.instantiateGmDecor(gmId, gm);
          await pause();
        }
      } else {
        // Only re-instantiate changed geomorphs
        for (const [gmId, gm] of w.gms.entries()) {
          if (prev[gm.key] === next[gm.key]) {
            continue;
          }
          state.removeInstantiated(gmId);
          state.instantiateGmDecor(gmId, gm);
          await pause();
        }
      }

      state.hash = next;
      update();
      return null;
    },
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false, // fix dup invokes
    staleTime: Infinity,
    gcTime: 0,
    // throwOnError: true,
  }).status;

  const labels = state.showLabels ? state.labels : [];

  React.useEffect(() => {
    if (state.queryStatus === 'success') {
      w.events.next({ key: 'decor-instantiated' });
      state.addQuadUvs();
      state.positionInstances();
    }
  }, [state.queryStatus, state.cuboids.length, state.quads.length, labels.length]);

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

    <instancedMesh
      name="decor-labels"
      key={`${labels.length} labels`}
      ref={instances => instances && (state.labelInst = instances)}
      args={[state.label.quad, undefined, labels.length]}
      frustumCulled={false}
    >
      {/* <meshBasicMaterial color="red" /> */}
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        map={state.label.tex}
        transparent
        diffuse={new THREE.Vector3(1, 1, 1)}
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
 * @property {Record<string, Geomorph.Decor>} byKey
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {Geomorph.DecorCuboid[]} cuboids
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {{ mapHash: number; } & Record<Geomorph.GeomorphKey, number>} hash
 * If any decor changed in a geomorph re-instantiate all.
 * Record previous map so can remove stale decor
 * @property {Geomorph.DecorPoint[]} labels
 * @property {THREE.InstancedMesh} labelInst
 * @property {LabelsMeta} label
 * @property {(Geomorph.DecorPoint | Geomorph.DecorPoly)[]} quads
 * This is `Object.values(state.byKey)`
 * @property {THREE.BufferGeometry} quadGeom
 * @property {THREE.InstancedMesh} quadInst
 * @property {import("@tanstack/react-query").QueryStatus} queryStatus
 * @property {Set<string>} rmKeys decorKeys manually removed via `removeDecorFromRoom`,
 * but yet added back in. This is useful e.g. so can avoid re-instantiating geomorph decor
 * @property {boolean} showLabels
 *
 * @property {(ds: Geomorph.Decor[], removeExisting?: boolean) => void} addDecor
 * Can manually `removeExisting` e.g. during re-instantiation of geomorph decor
 * @property {() => void} addLabelUvs
 * @property {() => void} addQuadUvs
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} addDecorToRoom
 * @property {() => State['hash']} computeHash
 * @property {(d: Geomorph.DecorCuboid) => THREE.Matrix4} createCuboidMatrix4
 * @property {(d: Geomorph.DecorPoint | Geomorph.DecorPoly) => THREE.Matrix4} createQuadMatrix4
 * @property {(d: Geomorph.DecorPoint) => THREE.Matrix4} createLabelMatrix4
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => null | Geomorph.Decor} detectClick
 * @property {(d: Geomorph.Decor) => Geomorph.GmRoomId | null} ensureGmRoomId
 * @property {() => void} ensureLabelSheet
 * @property {(d: Geomorph.Decor) => Geom.VectJson} getDecorOrigin
 * @property {<T extends Geomorph.Decor>(d: T, gmId: number, gm: Geomorph.LayoutInstance) => T} instantiateDecor
 * @property {(gmId: number, gm: Geomorph.LayoutInstance) => void} instantiateGmDecor
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionInstances
 * @property {(...decorKeys: string[]) => void} removeDecor
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} removeDecorFromRoom
 * @property {() => void} removeAllInstantiated
 * @property {(gmId: number) => void} removeInstantiated
 * @property {() => void} updateDecorLists
 */

/**
 * @typedef LabelsMeta
 * @property {number} hash
 * @property {THREE.BufferGeometry} quad
 * @property {{ [label: string]: Geom.RectJson }} sheet
 * @property {THREE.CanvasTexture} tex
 */
