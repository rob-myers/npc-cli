import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { decorGridSize, decorIconRadius, fallbackDecorImgKey, gmLabelHeightSgu, sguToWorldScale, spriteSheetDecorExtraScale, spriteSheetLabelExtraScale, wallHeight } from "../service/const";
import { isDevelopment, pause, removeDups, testNever, warn } from "../service/generic";
import { tmpMat1, tmpRect1 } from "../service/geom";
import { geomorph } from "../service/geomorph";
import { addToDecorGrid, removeFromDecorGrid } from "../service/grid";
import { createLabelSpriteSheet, getBoxGeometry, getColor, getQuadGeometryXY, getQuadGeometryXZ, getRotAxisMatrix, setRotMatrixAboutPoint, tmpMatFour1 } from "../service/three";
import * as glsl from "../service/glsl";
import { helper } from "../service/helper";
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
    cuboidGeom: getBoxGeometry(`${w.key}-decor-cuboid`),
    cuboids: [],
    cuboidInst: /** @type {*} */ (null),
    seenHash : /** @type {Geomorph.GeomorphsHash} */ ({}),
    labels: [],
    labelInst: /** @type {*} */ (null),
    label: {
      numLabels: 0,
      lookup: {},
      tex: new THREE.CanvasTexture(document.createElement('canvas')),
    },
    labelQuad: getQuadGeometryXY(`${w.key}-decor-labels-xy`, true),
    quads: [],
    quad: getQuadGeometryXZ(`${w.key}-decor-xz`),
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

      if (removeExisting) {
        Object.values(grouped).forEach(({ meta, remove }) =>
          state.removeDecorFromRoom(meta.gmId, meta.roomId, remove)
        );
      }

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
    addGm(gmId) {
      const gm = w.gms[gmId];
      state.addDecor(gm.decor.map(d => state.instantiateDecor(d, gmId, gm))
        // Don't re-instantiate explicitly removed
        .filter(d => !state.rmKeys.has(d.key) && (d.meta.roomId >= 0 ||
          warn(`decor "${d.key}" cannot be instantiated: not in any room`, d)
        )
      ), false);
    },
    addCuboidAttributes() {
      const instanceIds = state.cuboids.map((_, instanceId) => instanceId);
      state.cuboidGeom.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Int32Array(instanceIds), 1),
      );
    },
    addLabelUvs() {
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const { lookup: sheet, tex } = state.label;
      const { width: sheetWidth, height: sheetHeight } = /** @type {HTMLCanvasElement} */ (tex.image);

      for (const d of state.labels) {
        const { x, y, width, height } = sheet[d.meta.label];
        uvOffsets.push(x / sheetWidth, y / sheetHeight);
        uvDimensions.push(width / sheetWidth, height / sheetHeight);
      }

      state.labelQuad.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.labelQuad.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
    },
    addQuadUvs() {
      const { decor: sheet, maxDecorDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const uvTextureIds = /** @type {number[]} */ ([]);
      const instanceIds = /** @type {number[]} */ ([]);
      
      for (const [instanceId, d] of state.quads.entries()) {
        if (d.type === 'point') {
          const { x, y, width, height, sheetId } = sheet[
            geomorph.isDecorImgKey(d.meta.img) ? d.meta.img : fallbackDecorImgKey.point
          ];
          uvTextureIds.push(sheetId);

          uvOffsets.push(x / maxDecorDim.width, y / maxDecorDim.height);
          uvDimensions.push(width / maxDecorDim.width, height / maxDecorDim.height);
        } else {
          const { x, y, width, height, sheetId } = sheet[
            geomorph.isDecorImgKey(d.meta.img) ? d.meta.img : fallbackDecorImgKey.quad
          ];
          uvTextureIds.push(sheetId);
          
          if (d.det < 0) {// fix "flipped" decor quads
            uvOffsets.push((x + width) / maxDecorDim.width, y / maxDecorDim.height);
            uvDimensions.push(-width / maxDecorDim.width, height / maxDecorDim.height);
          } else {
            uvOffsets.push(x / maxDecorDim.width,  y / maxDecorDim.height);
            uvDimensions.push(width / maxDecorDim.width, height / maxDecorDim.height);
          }
        }

        instanceIds.push(instanceId);
      }

      state.quad.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.quad.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
      state.quad.setAttribute('uvTextureIds',
        new THREE.InstancedBufferAttribute(new Int32Array(uvTextureIds), 1),
      );
      state.quad.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Int32Array(instanceIds), 1),
      );
    },
    computeDecorMeta(decor, instanceId) {
      /** @type {Geom.Meta} */
      const meta = { decor: true, ...decor.meta, instanceId };
      if (decor.type === 'point' && decor.meta.do === true) {
        meta.doPoint = { x: decor.x, y: decor.y };
      }
      return meta;
    },
    createCuboidMatrix4(d) {
      tmpMat1.feedFromArray(d.transform);
      return geomorph.embedXZMat4(tmpMat1.toArray(), {
        mat4: tmpMatFour1,
        yHeight: d.meta.y + (d.meta.h / 2),
        yScale: d.meta.h, // scaling centred unit cuboid
      }).multiply(centreUnitQuad);
    },
    createLabelMatrix4(d) {
      const { width, height } = state.label.lookup[d.meta.label];
      const scale = sguToWorldScale * (1 / spriteSheetLabelExtraScale);
      const transform = [
        width * scale, 0, 0, height * scale,
        d.x - (width * scale) / 2,
        d.y - (height * scale) / 2,
      ];
      // return geomorph.embedXZMat4(transform, {
      //   mat4: tmpMatFour1,
      //   yHeight: wallHeight + 0.1,
      // });
      return tmpMatFour1.set(
        transform[0], 0, 0, transform[4],
        0, transform[3], 0, wallHeight + 0.2,
        0, 0, 1, transform[5],
        0, 0, 0, 1
      );
    },
    createQuadMatrix4(d) {
      if (d.type === 'point') {
        // move to center, scale, possibly rotate
        const radians = d.orient * (Math.PI / 180);
        if (radians !== 0) {
          tmpMat1.feedFromArray([1, 0, 0, 1, -0.5, -0.5])
            .postMultiply([
              decorIconRadius * 2 * Math.cos(radians),
              decorIconRadius * 2 * Math.sin(radians),
              decorIconRadius * 2 * -Math.sin(radians),
              decorIconRadius * 2 * Math.cos(radians),
              d.x,
              d.y,
            ]);
        } else {
          tmpMat1.feedFromArray([
            decorIconRadius * 2, 0, 0, decorIconRadius * 2,
            d.x - decorIconRadius, d.y - decorIconRadius,
          ]);
        }

        return geomorph.embedXZMat4(tmpMat1.toArray(), {
          mat4: tmpMatFour1,
          yHeight: d.meta.y,
        });
      
      } else {// d.type === 'quad'

        tmpMat1.feedFromArray(d.transform);
        const mat4 = geomorph.embedXZMat4(tmpMat1.toArray(), {
          mat4: tmpMatFour1,
          yHeight: d.meta.y,
        });

        if (d.meta.tilt === true) {
          // 🔔 remove scale to get local x unit vector
          const vecLen = Math.sqrt(tmpMat1.a ** 2 + tmpMat1.b ** 2);
          const rotMat = getRotAxisMatrix(tmpMat1.a / vecLen, 0, tmpMat1.b / vecLen, 90);
          setRotMatrixAboutPoint(rotMat, d.center.x, d.meta.y, d.center.y);
          mat4.premultiply(rotMat); // 🔔 premultiply means post-rotate
        }

        return mat4;
      }
    },
    ensureGmRoomId(decor) {
      if (!(decor.meta.gmId >= 0 && decor.meta.roomId >= 0)) {
        const decorOrigin = state.getDecorOrigin(decor);
        const gmRoomId = w.gmGraph.findRoomContaining(decorOrigin);
        return gmRoomId === null ? null : Object.assign(decor.meta, gmRoomId);
      } else {
        decor.meta.grKey ??= helper.getGmRoomKey(decor.meta.gmId, decor.meta.roomId);
        return decor.meta;
      }
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
        case "cuboid": {
          const center = gm.matrix.transformPoint({ x: d.center.x, y: d.center.z });
          instance = { ...d, ...base,
            center: { x: center.x, y: d.center.y, z: center.y },
            transform: tmpMat1.setMatrixValue(gm.matrix).preMultiply(d.transform).toArray(),
          };
          break;
        }
        case "point": {
          // +90 after transform so bottom-to-top sprite-sheet text "faces" direction
          const orient = (gm.matrix.transformDegrees(d.orient) + 90) % 360;
          instance = gm.matrix.transformPoint(/** @type {Geomorph.DecorPoint} */ ({ ...d, ...base, orient }));
          instance.meta.orient = orient; // update `meta` too
          break;
        }
        case "rect":
          instance = { ...d, ...base,
            center: gm.matrix.transformPoint({ ...d.center }),
            points: d.points.map(p => gm.matrix.transformPoint({ ...p })),
          };
          break;
        case "quad":
          instance = { ...d, ...base, meta: d.meta,
            center: gm.matrix.transformPoint({ ...d.center }),
            transform: tmpMat1.setMatrixValue(gm.matrix).preMultiply(d.transform).toArray(),
            det: tmpMat1.a * tmpMat1.d - tmpMat1.b * tmpMat1.c,
          };
          break;
        default:
          throw testNever(d);
      }
      instance.key = geomorph.getDerivedDecorKey(instance);
      return /** @type {typeof d} */ (instance);
    },
    positionInstances() { 
      const { cuboidInst, quadInst, labelInst } = state;
      
      const defaultCuboidColor = '#ddd'; // 🚧 move to const
      for (const [instId, d] of state.cuboids.entries()) {
        const mat4 = state.createCuboidMatrix4(d);
        cuboidInst.setMatrixAt(instId, mat4);
        cuboidInst.setColorAt(instId, getColor(d.meta.color ?? defaultCuboidColor));
      }
      
      const defaultQuadColor = 'white'; // 🚧 move to const
      for (const [instId, d] of state.quads.entries()) {
        const mat4 = state.createQuadMatrix4(d);
        quadInst.setMatrixAt(instId, mat4);
        quadInst.setColorAt(instId, getColor(d.meta.color ?? defaultQuadColor));
      }

      for (const [instId, d] of state.labels.entries()) {
        const mat4 = state.createLabelMatrix4(d);
        labelInst.setMatrixAt(instId, mat4);
      }
    
      cuboidInst.instanceMatrix.needsUpdate = true;
      if (cuboidInst.instanceColor !== null) {
        cuboidInst.instanceColor.needsUpdate = true;
      }
      cuboidInst.computeBoundingSphere();
      quadInst.instanceMatrix.needsUpdate = true;
      if (quadInst.instanceColor !== null) {
        quadInst.instanceColor.needsUpdate = true;
      }
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
    removeGm(gmId) {
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
        geomorph.isDecorCuboid
      );

      // 🚧 elements of state.byKey should have sheetId
      state.quads = Object.values(state.byKey).filter(
        /** @returns {x is Geomorph.DecorPoint | Geomorph.DecorQuad} */
        x => x.type === 'point' && (
          x.meta.do === true || x.meta.button === true
        ) || x.type === 'quad' && (
          typeof x.meta.img === 'string' // 🚧 warn if n'exist pas?
        )
      );
    },
  }));

  w.decor = state;
  
  // instantiate geomorph decor
  const query = useQuery({
    queryKey: ['decor', w.key, w.mapKey, w.hash.decor, w.hash.sheets],

    async queryFn() {
      if (module.hot?.active === false) {
        return false; // Avoid query from disposed module
      }
      const prev = state.seenHash;
      const next = w.hash;
      const mapChanged = prev.map !== next.map;
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;

      state.labels = w.gms.flatMap((gm, gmId) => gm.labels.map(d => state.instantiateDecor(d, gmId, gm)));
      createLabelSpriteSheet(
        removeDups(state.labels.map(x => /** @type {string} */ (x.meta.label))),
        state.label,
        { fontHeight },
      );
      state.addLabelUvs();

      w.menu.measure('decor.addGm');

      if (mapChanged) {
        // Re-instantiate all cleanly
        state.removeAllInstantiated();
        for (const [gmId, gm] of w.gms.entries()) {
          state.byRoom[gmId] ??= gm.rooms.map(_ => new Set());
          gm.rooms.forEach((_, roomId) => state.byRoom[gmId][roomId] ??= new Set());
        };
        await pause();

        for (const [gmId] of w.gms.entries()) {
          state.addGm(gmId);
          await pause();
        }
        w.events.next({ key: 'updated-gm-decor', type: 'all' });
      } else {
        // Only re-instantiate changed geomorphs
        for (const [gmId, gm] of w.gms.entries()) {
          if (prev[gm.key] === next[gm.key]) {
            continue;
          }
          state.removeGm(gmId);
          state.addGm(gmId);
          await pause();
        }
        w.events.next({
          key: 'updated-gm-decor',
          type: 'partial',
          gmIds: w.gms.flatMap((gm, gmId) =>
            prev[gm.key].decor !== next[gm.key].decor ? gmId : []
          ),
        });
      }

      w.menu.measure('decor.addGm');
      state.seenHash = next;
      update();
      return true;
    },
    // refetchOnMount: false,
    // refetchOnReconnect: false,
    // staleTime: Infinity,
    // 👆 all above stopped hmr
    refetchOnWindowFocus: false,
    retry: false, // fix dup invokes
    gcTime: 0,
    // throwOnError: true,
    networkMode: isDevelopment() ? 'always' : 'online',
  });

  state.queryStatus = query.status;
  const labels = state.showLabels ? state.labels : [];

  React.useEffect(() => {
    if (query.data === true) {
      state.addQuadUvs();
      state.addCuboidAttributes();
      state.positionInstances();
    } else if (query.data === false) {
      query.refetch(); // hmr
    }
  }, [query.data, state.cuboids.length, state.quads.length, labels.length]);

  const update = useUpdate();

  return <>
    <instancedMesh // cuboids
      name="decor-cuboids"
      key={`${state.cuboids.length} cuboids`}
      ref={instances => instances && (state.cuboidInst = instances)}
      args={[state.cuboidGeom, undefined, state.cuboids.length]}
      frustumCulled={false}
      renderOrder={-1}
      visible={state.cuboids.length > 0} // avoid initial flicker
    >
      {/* <meshBasicMaterial color="red" side={THREE.DoubleSide} /> */}
      <cameraLightMaterial
        key={glsl.CameraLightMaterial.key}
        side={THREE.DoubleSide} // fix flipped gm
        diffuse={[1, 1, 1]}
        transparent
        objectPickRed={7}
      />
    </instancedMesh>

    <instancedMesh //quads
      name="decor-quads"
      key={`${state.quads.length} quads`}
      ref={instances => instances && (state.quadInst = instances)}
      args={[state.quad, undefined, state.quads.length]}
      frustumCulled={false}
      // visible={state.quads.length > 0} // 🚧 avoid initial flicker
    >
      {/* <meshBasicMaterial color="red" /> */}
      <instancedMultiTextureMaterial
        key={glsl.InstancedMultiTextureMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={w.texDecor.tex}
        diffuse={[1, 1, 1]}
        objectPickRed={5}
        // depthWrite={false} // fix z-fighting
        alphaTest={0.5}
      />
    </instancedMesh>

    <instancedMesh // labels
      name="decor-labels"
      key={`${labels.length} labels`}
      ref={instances => void (instances && (state.labelInst = instances))}
      args={[state.labelQuad, undefined, labels.length]}
      frustumCulled={false}
    >
      {/* <meshBasicMaterial color="red" /> */}
      <instancedLabelsMaterial
        key={glsl.InstancedLabelsMaterial.key}
        side={THREE.DoubleSide}
        map={state.label.tex}
        transparent
        diffuse={new THREE.Vector3(1, 1, 0.8)}
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
 * Decor in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {Record<string, Geomorph.Decor>} byKey
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {THREE.BoxGeometry} cuboidGeom
 * @property {Geomorph.DecorCuboid[]} cuboids
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {Geomorph.GeomorphsHash} seenHash Last seen value of `w.hash`
 * @property {Geomorph.DecorPoint[]} labels
 * @property {THREE.InstancedMesh} labelInst
 * @property {import("../service/three").LabelsSheetAndTex} label
 * @property {THREE.BufferGeometry} labelQuad
 * @property {(Geomorph.DecorPoint | Geomorph.DecorQuad)[]} quads
 * This is `Object.values(state.byKey)`
 * @property {THREE.BufferGeometry} quad
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
 * @property {() => void} addCuboidAttributes
 * @property {(decor: Geomorph.Decor, instanceId: number) => Geom.Meta} computeDecorMeta
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} addDecorToRoom
 * @property {(d: Geomorph.DecorCuboid) => THREE.Matrix4} createCuboidMatrix4
 * @property {(d: Geomorph.DecorPoint | Geomorph.DecorQuad) => THREE.Matrix4} createQuadMatrix4
 * @property {(d: Geomorph.DecorPoint) => THREE.Matrix4} createLabelMatrix4
 * @property {(d: Geomorph.Decor) => Geomorph.GmRoomId | null} ensureGmRoomId
 * @property {(d: Geomorph.Decor) => Geom.VectJson} getDecorOrigin
 * @property {<T extends Geomorph.Decor>(d: T, gmId: number, gm: Geomorph.LayoutInstance) => T} instantiateDecor
 * @property {(gmId: number) => void} addGm
 * @property {() => void} positionInstances
 * @property {(...decorKeys: string[]) => void} removeDecor
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} removeDecorFromRoom
 * @property {() => void} removeAllInstantiated
 * @property {(gmId: number) => void} removeGm
 * @property {() => void} updateDecorLists
 */

const centreUnitQuad = new THREE.Matrix4().makeTranslation(-(-0.5), 0, -(-0.5));
