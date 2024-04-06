import React from "react";
import * as THREE from "three";
import { NavMeshHelper } from "@recast-navigation/three";

import { wireFrameMaterial } from "../service/three";
import { warn } from "../service/generic";
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
    selectNavPolys(polyIds) {
      // 🚧
      const { navMesh } = api.nav;
      const geom = new THREE.BufferGeometry();
      const vertices = /** @type {THREE.Vector3Tuple[]} */ ([]);
      const triangles = /** @type {number[][]} */ [];
      
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

        // 🚧 use `state.ptrToTilePolyId` to infer `tilePolyIndex`
        // const polyVertCount = poly.vertCount();
        // const polyDetail = tile.detailMeshes(tilePolyIndex);
        // const polyDetailTriBase = polyDetail.triBase();
        // const polyDetailTriCount = polyDetail.triCount();
      }

      state.selectedNavPolys = geom;
      update();
    },
  }));

  api.debug = state;

  React.useMemo(() => {
    const { navMesh } = api.nav;

    state.navMesh = new NavMeshHelper({
      navMesh,
      navMeshMaterial: wireFrameMaterial,
    });

    const numTiles = navMesh.getMaxTiles();
    for (let i = 0; i < numTiles; i++) {
      const tile = navMesh.getTile(i);
      const header = tile.header();
      if (!header || header.polyCount() === 0)
        break; // 🚧 used tiles contiguous?
      const numTilePolys = header.polyCount();
      for (let j = 0; j < numTilePolys; j++) {
        //@ts-expect-error
        const ptr =  tile.polys(j).raw.ptr;
        state.ptrToTilePolyId[ptr] = [i, j];
      }
    }

    // 🚧 too many tiles!
    console.info(state.ptrToTilePolyId);
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
          args={[api.gmData[gm.key].debugNavPoly, origNavPolyMaterial]}
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
  opacity: 0.4,
});
