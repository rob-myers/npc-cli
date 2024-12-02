import * as THREE from "three";
import { init as initRecastNav, exportTileCache } from "@recast-navigation/core";

import { alloc, error, info, debug, warn, removeDups } from "../service/generic";
import { geomorph } from "../service/geomorph";
import { decompToXZGeometry, polysToXZGeometry } from "../service/three";
import { customThreeToTileCache, getTileCacheGeneratorConfig, getBasicTileCacheMeshProcess } from "../service/recast-detour";
import { fetchGeomorphsJson } from "../service/fetch-assets";

/** @type {WW.WorkerGeneric<WW.MsgFromNavWorker, WW.MsgToNavWorker>} */
const worker = (/** @type {*} */ (self));

if (typeof window === 'undefined') {
  info("🤖 nav.worker started", import.meta.url);
  worker.addEventListener("message", handleMessages);
}

/** @param {MessageEvent<WW.MsgToNavWorker>} e */
async function handleMessages(e) {
  const msg = e.data;
  debug("🤖 nav.worker received", JSON.stringify(msg));

  if (msg.type === 'request-nav') {
    const geomorphs = geomorph.deserializeGeomorphs(await fetchGeomorphsJson());
  
    const { mapKey } = msg;
    const map = geomorphs.map[mapKey ?? "demo-map-1"];
    const gms = map.gms.map(({ gmKey, transform }, gmId) =>
      geomorph.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
    );
  
    const customAreaDefs = /** @type {NPC.TileCacheConvexAreaDef[]} */ ([]);
    const meshes = gms.map(({ navDecomp, navDoorwaysOffset, mat4, transform: [a, b, c, d, e, f] }, gmId) => {
      const determinant = a * d - b * c;
      // const mesh = new THREE.Mesh(polysToXZGeometry(navPolys, { reverse: determinant === 1 }));
      const mesh = new THREE.Mesh(decompToXZGeometry(navDecomp, { reverse: determinant === 1 }));
      // const mesh = new THREE.Mesh(decompToXZGeometry({
      //   vs: navDecomp.vs,
      //   tris: navDecomp.tris.slice(0, navDoorwaysOffset),
      // }, { reverse: determinant === 1 }));
      mesh.applyMatrix4(mat4);
      mesh.updateMatrixWorld();
      
      const { tris, vs, tris: { length: numTris } } = navDecomp;
      const allVerts = vs.map(v => (new THREE.Vector3(v.x, 0, v.y)).applyMatrix4(mat4))
      for (let i = navDoorwaysOffset; i < numTris; i++) {
        customAreaDefs.push({
          areaId: 1, // 🚧
          areas: [
            { hmin: 0, hmax: 0.02, verts: tris[i].map(id => allVerts[id]) }
          ]
        });
      }
      return mesh;
    });
  
    debug('🤖 nav.worker', {
      'total vertices': meshes.reduce((agg, mesh) => agg + (mesh.geometry.getAttribute('position')?.count ?? 0), 0),
      'total triangles': meshes.reduce((agg, mesh) => agg + (mesh.geometry.index?.count ?? 0) / 3, 0),
      'total meshes': meshes.length,
    });
  
    await initRecastNav();
    const tileCacheMeshProcess = getBasicTileCacheMeshProcess();
  
    const result = customThreeToTileCache(
      meshes,
      getTileCacheGeneratorConfig(tileCacheMeshProcess),
      { areas: customAreaDefs },
    );
    
    if (result.success) {
      const { navMesh, tileCache } = result;
      const polysPerTile = alloc(navMesh.getMaxTiles()).flatMap((_, i) =>
        navMesh.getTile(i).header()?.polyCount() ?? []
      );
      info('🤖 nav.worker', { totalTiles: polysPerTile.length, polysPerTile });
  
      worker.postMessage({
        type: "nav-mesh-response",
        mapKey,
        exportedNavMesh: exportTileCache(navMesh, tileCache),
      });
  
      tileCache.destroy();
      navMesh.destroy();
    } else {
      error(`Failed to compute navMesh: ${'error' in result ? result.error : 'unknown error'}`);
    }
  
    meshes.forEach((mesh) => mesh.geometry.dispose());
  }
}
