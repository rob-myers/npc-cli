import React from "react";
import * as THREE from "three";
import { NavMeshHelper } from "@recast-navigation/three";
import { Line2, LineGeometry } from "three-stdlib";

import { navMeta, decompToXZGeometry } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props 
 */
export default function Debug(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    navMesh: /** @type {*} */ (null),
    navPath: /** @type {*} */ (null),
    selectedNavPolys: new THREE.BufferGeometry(),

    ensureNavPoly(gmKey) {
      if (!w.gmsData[gmKey].navPoly) {
        const layout = w.geomorphs.layout[gmKey];
        // Fix normals for recast/detour -- triangulation ordering?
        w.gmsData[gmKey].navPoly = decompToXZGeometry(layout.navDecomp, { reverse: true });
        update();
      }
    },
    setNavPath(path) {
      const group = state.navPath;
      group.children.forEach((x) =>
        x instanceof THREE.Mesh && x.geometry instanceof LineGeometry && x.geometry.dispose()
      );
      group.remove(...group.children);
  
      if (path.length) {
        const linesGeometry = new LineGeometry();
    
        linesGeometry.setPositions(path.flatMap(({ x, y, z }) => [x, y + navMeta.groundOffset, z]));
        showNavNodes && group.add(...path.map(() => new THREE.Mesh(navMeta.nodeGeometry, navMeta.nodeMaterial)));
        group.add(new Line2(linesGeometry, navMeta.lineMaterial));
    
        showNavNodes && group.children.slice(0, -1).forEach((x, i) => {
          x.visible = true;
          x.position.copy(path[i]);
          x.position.y += navMeta.groundOffset;
        });
      }

      group.visible = true;
    },
    selectNavPolys(polyRefs) {
      const { navMesh } = w.nav;
      const geom = new THREE.BufferGeometry();
      const positions = /** @type {number[]} */ ([]);
      const indices = /** @type {number[][]} */ [];
      let tri = 0;
      
      for (const polyRef of polyRefs) {
        const { tileIndex, tilePolygonIndex } = navMesh.decodePolyId(polyRef);
        const tile = navMesh.getTile(tileIndex);
        const poly = tile.polys(tilePolygonIndex);
        if (poly.getType() === 1) {
          continue; // Ignore off-mesh connections
        }

        const polyVertCount = poly.vertCount();
        const polyDetail = tile.detailMeshes(tilePolygonIndex);
        const polyDetailTriBase = polyDetail.triBase();
        const polyDetailTriCount = polyDetail.triCount();

        for (let triId = 0; triId < polyDetailTriCount; triId++) {
          const detailTrisBaseId = (polyDetailTriBase + triId) * 4;
          for (let i = 0; i < 3; i++) {
            if (tile.detailTris(detailTrisBaseId + i) < polyVertCount) {
              const tileVertsBaseId = poly.verts(tile.detailTris(detailTrisBaseId + i)) * 3;
              positions.push(
                tile.verts(tileVertsBaseId),
                tile.verts(tileVertsBaseId + 1) + 0.1,
                tile.verts(tileVertsBaseId + 2)
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

  w.debug = state;

  React.useMemo(() => {
    state.navMesh = new NavMeshHelper({
      navMesh: w.nav.navMesh,
      navMeshMaterial: navPolyMaterial,
    });
  }, [w.nav.navMesh]);

  const update = useUpdate();

  return <>

    <primitive
      name="NavMeshHelper"
      position={[0, 0.01, 0]}
      object={state.navMesh}
      visible={!!props.showNavMesh}
    />

    <group
      name="NavPathHelper"
      ref={x => x && (state.navPath = x)}
    />

    <mesh
      name="SelectedNavPolys"
      args={[state.selectedNavPolys, selectedNavPolysMaterial]}
    />

    {props.showOrigNavPoly && w.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        ref={(group) => group && state.ensureNavPoly(gm.key)}
      >
        <mesh
          name="origNavPoly"
          args={[w.gmsData[gm.key].navPoly, origNavPolyMaterial]}
          position={[0, 0.0001, 0]}
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
 * @property {THREE.Group} navPath
 * @property {THREE.BufferGeometry} selectedNavPolys
 * @property {(gmKey: Geomorph.GeomorphKey) => void} ensureNavPoly
 * @property {(path: THREE.Vector3Like[]) => void} setNavPath
 * @property {(polyIds: number[]) => void} selectNavPolys
 */

const origNavPolyMaterial = new THREE.MeshBasicMaterial({
  side: THREE.FrontSide,
  color: "green",
  // wireframe: true,
  transparent: true,
  opacity: 0.8,
});

const navPolyMaterial = new THREE.MeshStandardMaterial({
  wireframe: true,
  color: "#ff0",
  transparent: true,
  opacity: 1,
});


const selectedNavPolysMaterial = new THREE.MeshBasicMaterial({
  side: THREE.FrontSide,
  color: "blue",
  wireframe: false,
  transparent: true,
  opacity: 0.5,
});

const showNavNodes = false;
