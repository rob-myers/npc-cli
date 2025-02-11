import React from "react";
import * as THREE from "three";
import { NavMeshHelper } from "@recast-navigation/three";
import { Line2, LineGeometry } from "three-stdlib";

import { OffMeshConnectionsHelper } from "../service/off-mesh-connections-helper";
import { colliderHeight } from "../service/const";
import { navMeta, decompToXZGeometry, cylinderGeometry, boxGeometry } from "../service/three";
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
    offMeshConnections: /** @type {*} */ (null),
    navPath: /** @type {*} */ (null),
    pick: null,
    physicsLines: new THREE.BufferGeometry(),
    selectedNavPolys: null,
    staticColliders: [],

    ensureNavPoly(gmKey) {
      if (!w.gmsData[gmKey].navPoly) {
        const layout = w.geomorphs.layout[gmKey];
        // Fix normals for recast/detour -- triangulation ordering?
        w.gmsData[gmKey].navPoly = decompToXZGeometry(layout.navDecomp, { reverse: true });
        update();
      }
    },
    onPhysicsDebugData(e) {
      if (e.data.type === 'debug-data') {
        // console.log('🔔 RECEIVED', e.data);
        state.staticColliders = e.data.items;
        state.physicsLines.dispose();
        state.physicsLines = new THREE.BufferGeometry();
        state.physicsLines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(e.data.lines), 3))
        w.physics.worker.removeEventListener('message', state.onPhysicsDebugData);
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
    selectNavPolys(...polyRefs) {
      if (polyRefs.length === 0) {
        state.selectedNavPolys = null;
        return update();
      }
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
            } else {// 🚧 explain this case
              const tileVertsBaseIndex =
                (polyDetail.vertBase() +
                  tile.detailTris(detailTrisBaseId + i) -
                  poly.vertCount()) *
                3;
  
              positions.push(
                tile.detailVerts(tileVertsBaseIndex),
                tile.detailVerts(tileVertsBaseIndex + 1),
                tile.detailVerts(tileVertsBaseIndex + 2)
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
    setPickIndicator(downData) {
      state.pick = downData || null;
      update();
    },
  }));

  w.debug = state;

  React.useMemo(() => {
    state.navMesh = new NavMeshHelper(w.nav.navMesh, {
      navMeshMaterial: navPolyMaterial,
    });

    /** Use offMeshLookup to exclude non-existent ones through isolated hull doors  */
    const offMeshParams = Object.values(w.nav.offMeshLookup).map(x => ({
        startPosition: x.src,
        endPosition: x.dst,
        radius: 0.04,
        bidirectional: true,
    }));
    // const offMeshParams = computeOffMeshConnectionsParams(w.gms);

    state.offMeshConnections = new OffMeshConnectionsHelper(offMeshParams, {
      lineMaterial: offMeshLineMaterial,
      entryCircleMaterial: navPolyMaterial,
      exitCircleMaterial: navPolyMaterial,
    });
  }, [w.nav.navMesh]);

  React.useEffect(() => {// debug colliders via physics.worker
    if (props.showStaticColliders) {
      w.physics.worker.addEventListener('message', state.onPhysicsDebugData);
      w.physics.worker.postMessage({ type: 'get-debug-data' });
      return () => void w.physics.worker.removeEventListener('message', state.onPhysicsDebugData);
    } else {
      state.staticColliders = [];
      state.physicsLines = new THREE.BufferGeometry();
      update();
    }
  }, [props.showStaticColliders, w.physics.rebuilds]);


  const update = useUpdate();

  return <> 
    
    <mesh
      name="origin"
      scale={[0.025, 1, 0.025]}
      position={[0, 0.5 - 0.001, 0]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="red" />
    </mesh>

    <group
      name="nav-path-helper"
      ref={state.ref('navPath')}
    />

    {state.pick !== null && <group
      name="object-pick-indicator"
      position={state.pick.position}
      quaternion={state.pick.quaternion}
    >
      <mesh
        position={[0.01, 0, 0]}
        rotation={[Math.PI / 8, Math.PI/2, 0]}
        renderOrder={1}
      >
        <circleGeometry args={[0.08, 8]} />
        <meshBasicMaterial color="#0f9" opacity={0.5} transparent wireframe={false} />
      </mesh>
    </group>}

    {props.showNavMesh === true && <>
      <primitive
        name="nav-mesh-helper"
        position={[0, 0.01, 0]}
        object={state.navMesh}
      />
      <primitive
        name="off-mesh-connection-helper"
        position={[0, 0.02, 0]}
        object={state.offMeshConnections}
      />
    </>}

    {state.selectedNavPolys !== null && <mesh
      name="selected-nav-polys"
      args={[state.selectedNavPolys, selectedNavPolysMaterial]}
      renderOrder={0}
    />}

    {props.showOrigNavPoly === true && w.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        ref={(group) => group && state.ensureNavPoly(gm.key)}
      >
        <mesh
          name="orig-nav-poly"
          args={[w.gmsData[gm.key].navPoly, origNavPolyMaterial]}
          position={[0, 0.0001, 0]}
          visible={props.showOrigNavPoly}
        />
      </group>
    ))}
    
    {state.staticColliders.length > 0 && <group
      name="static-colliders"
      visible={state.staticColliders.length > 0}
    >
      <lineSegments geometry={state.physicsLines}>
        <lineBasicMaterial color="green" />
      </lineSegments>
      <MemoizedStaticColliders
        staticColliders={state.staticColliders}
        w={w}
      />
    </group>}
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {boolean} [showNavMesh]
 * @property {boolean} [showOrigNavPoly]
 * @property {boolean} [showStaticColliders]
 */

/**
 * @typedef State
 * @property {NavMeshHelper} navMesh
 * @property {OffMeshConnectionsHelper} offMeshConnections
 * @property {THREE.Group} navPath
 * @property {null | THREE.BufferGeometry} selectedNavPolys
 * @property {(WW.PhysicDebugItem & { parsedKey: WW.PhysicsParsedBodyKey })[]} staticColliders
 * @property {null | NPC.DownData} pick
 * @property {THREE.BufferGeometry} physicsLines
 * @property {(gmKey: Geomorph.GeomorphKey) => void} ensureNavPoly
 * @property {(e: MessageEvent<WW.MsgFromPhysicsWorker>) => void} onPhysicsDebugData
 * @property {(path: THREE.Vector3Like[]) => void} setNavPath
 * @property {(...polyIds: number[]) => void} selectNavPolys
 * https://github.com/isaac-mason/recast-navigation-js/blob/bb3e49af3f4ff274afe84341d4c51a9f5fac609c/apps/navmesh-website/src/features/recast/export/nav-mesh-to-gltf.ts#L31
 * @property {(downData?: NPC.DownData) => void} setPickIndicator
 */

const origNavPolyMaterial = new THREE.MeshBasicMaterial({
  side: THREE.FrontSide,
  color: "yellow",
  wireframe: true,
  transparent: true,
  opacity: 0.8,
});

const navPolyMaterial = new THREE.MeshBasicMaterial({
  wireframe: true,
  color: "#7f7",
  transparent: true,
  opacity: 1,
});

const offMeshLineMaterial = new THREE.LineBasicMaterial({
  color: "#ff7",
});

const selectedNavPolysMaterial = new THREE.MeshBasicMaterial({
  side: THREE.FrontSide,
  color: "red",
  wireframe: false,
  transparent: true,
  opacity: 0.5,
});

const showNavNodes = true;

const MemoizedStaticColliders = React.memo(StaticColliders);

/**
 * 🔔 debug only (inefficient)
 * @param {{ staticColliders: State['staticColliders']; w: import('./World').State }} props
 */
function StaticColliders({ staticColliders, w }) {
  return staticColliders.map(({ parsedKey, position, userData }) => {

    if (userData.type === 'cylinder') {
      return (
        <mesh
          geometry={cylinderGeometry}
          position={[position.x, colliderHeight / 2, position.z]}
          scale={[userData.radius, colliderHeight, userData.radius]}
          renderOrder={toColliderMeta[parsedKey[0]]?.renderOrder ?? 3}
        >
          <meshBasicMaterial
            color={toColliderMeta[parsedKey[0]]?.color ?? 'blue'}
            transparent
            opacity={0.25}
          />
        </mesh>
      );
    }

    if (userData.type === 'cuboid') {
      return (
        <mesh
          geometry={boxGeometry}
          position={[position.x, colliderHeight / 2, position.z]}
          scale={[userData.width, colliderHeight, userData.depth]}
          rotation={[0, userData.angle, 0]}
          renderOrder={toColliderMeta[parsedKey[0]]?.renderOrder ?? 3}
        >
          <meshBasicMaterial
            color={toColliderMeta[parsedKey[0]]?.color ?? 'blue'}
            transparent
            opacity={0.25}
          />
        </mesh>
      );
    }

    return null;
  });
}

const toColliderMeta = /** @type {Record<string, { color: string; renderOrder: Number; }>} */ ({
  inside: { color: 'green', renderOrder: 1 },
  nearby: { color: 'red', renderOrder: 2 },
});
