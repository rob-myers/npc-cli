import React from "react";
import * as THREE from "three";
import { NavMeshHelper } from "@recast-navigation/three";

import { wireFrameMaterial } from "../service/three";
import { range, warn } from "../service/generic";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import NavPathHelper from "./NavPathHelper";

/**
 * @param {Props} props 
 */
export default function TestDebug(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    navMesh: /** @type {*} */ (null),
    navPath: new NavPathHelper(),
    ptrToTilePolyId: {},
    selectedNavPolys: new THREE.BufferGeometry(),

    // 🚧 better approach e.g. expose underlying encode/decode
    buildTilePolyIdLookup() {
      const { navMesh } = api.nav;
      const numTiles = navMesh.getMaxTiles();
      
      for (let i = 0; i < numTiles; i++) {
        const tile = navMesh.getTile(i);
        const header = tile.header();
        if (!header || header.polyCount() === 0) {
          break; // 🚧 used tiles contiguous?
        }
        const numTilePolys = header.polyCount();
        for (let j = 0; j < numTilePolys; j++) {
          //@ts-expect-error
          const ptr = tile.polys(j).raw.ptr;
          state.ptrToTilePolyId[ptr] = [i, j];
        }
      }
    },
    selectNavPolys(polyIds) {
      const { navMesh } = api.nav;
      const geom = new THREE.BufferGeometry();
      const positions = /** @type {number[]} */ ([]);
      const indices = /** @type {number[][]} */ [];
      let tri = 0;
      
      for (const polyId of polyIds) {
        const result = navMesh.getTileAndPolyByRef(polyId);
        const tile = result.tile();
        const tileHeader = tile.header();
        const poly = result.poly();
        if (!tileHeader) {
          warn(`getTileAndPolyByRef failed: ${polyId} (status ${result.status()})`);
          continue;
        }
        if (poly.getType() === 1) {
          continue; // Ignore off-mesh connections
        }

        // 🚧 compute tilePolyIndex in a better way
        const polyVertCount = poly.vertCount();
        const ptr = /** @type {*} */ (poly.raw).ptr;
        // lookup becomes stale on add/remove obstacle
        //@ts-expect-error
        const tilePolyIndex = state.ptrToTilePolyId[ptr]?.[1] ?? range(tileHeader.polyCount()).find(i => tile.polys(i).raw.ptr === poly.raw.ptr);

        const polyDetail = tile.detailMeshes(tilePolyIndex);
        const polyDetailTriBase = polyDetail.triBase();
        const polyDetailTriCount = polyDetail.triCount();

       for (let triId = 0; triId < polyDetailTriCount; triId++) {
        const detailTrisBaseIndex = (polyDetailTriBase + triId) * 4;
        for (let i = 0; i < 3; i++) {
          if (tile.detailTris(detailTrisBaseIndex + i) < polyVertCount) {
            const tileVertsBaseIndex = poly.verts(tile.detailTris(detailTrisBaseIndex + i)) * 3;
            positions.push(
              tile.verts(tileVertsBaseIndex),
              tile.verts(tileVertsBaseIndex + 1) + 0.1,
              tile.verts(tileVertsBaseIndex + 2)
            );
          }
          indices.push(tri++);
        }
       }
      }

      geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      geom.setIndex(indices);
      state.selectedNavPolys = geom;
      update();
    },
  }));

  api.debug = state;

  React.useMemo(() => {
    state.navMesh = new NavMeshHelper({
      navMesh: api.nav.navMesh,
      navMeshMaterial: wireFrameMaterial,
    });
    state.buildTilePolyIdLookup();
  }, [api.nav.navMesh]);

  const update = useUpdate();

  return <>

    <primitive
      name="NavMeshHelper"
      position={[0, 0.01, 0]}
      object={state.navMesh}
      visible={!!props.showNavMesh}
    />

    <primitive
      name="NavPathHelper"
      object={state.navPath}
    />

    <mesh
      name="SelectedNavPolys"
      args={[state.selectedNavPolys, selectedNavPolysMaterial]}
    />

    {props.showOrigNavPoly && api.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name="origNavPoly"
          args={[api.gmClass[gm.key].debugNavPoly, origNavPolyMaterial]}
          position={[0, 0.001, 0]}
          visible={props.showOrigNavPoly}
        />
      </group>
    ))}
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {boolean} [showNavMesh]
 * @property {boolean} [showOrigNavPoly]
 */

/**
 * @typedef State
 * @property {NavMeshHelper} navMesh
 * @property {NavPathHelper} navPath
 * @property {Record<number, [number, number]>} ptrToTilePolyId
 * @property {THREE.BufferGeometry} selectedNavPolys
 * @property {() => void} buildTilePolyIdLookup
 * @property {(polyIds: number[]) => void} selectNavPolys
 */

const origNavPolyMaterial = new THREE.MeshBasicMaterial({
  side: THREE.FrontSide,
  color: "green",
  wireframe: false,
  transparent: true,
  opacity: 0.4,
});

const selectedNavPolysMaterial = new THREE.MeshBasicMaterial({
  side: THREE.FrontSide,
  color: "blue",
  wireframe: false,
  transparent: true,
  opacity: 0.5,
});
