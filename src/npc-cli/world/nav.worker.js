import * as THREE from "three";
import { init as initRecastNav, exportTileCache } from "@recast-navigation/core";

import { error, info, debug, warn, removeDups, range } from "../service/generic";
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
    if (msg.method === 'all-at-once') createNavAllAtOnce(msg.mapKey);
    if (msg.method === 'tile-by-tile') createNavTileByTile(msg.mapKey);
  }
}

/** @param {string} mapKey  */
async function createNavAllAtOnce(mapKey) {
  const { meshes, customAreaDefs } = await computeGeomorphMeshes(mapKey);
  await initRecastNav();

  const result = customThreeToTileCache(
    meshes,
    getTileCacheGeneratorConfig(getBasicTileCacheMeshProcess()),
    { areas: customAreaDefs.flatMap(x => x) },
  );
  
  meshes.forEach((mesh) => mesh.geometry.dispose());
  if (!result.success) {
    error(`Failed to compute navMesh: ${'error' in result ? result.error : 'unknown error'}`);
    return;
  }

  logTileCount(result.navMesh);
  worker.postMessage({
    type: "nav-mesh-response",
    mapKey,
    exportedNavMesh: exportTileCache(result.navMesh, result.tileCache),
  });

  result.tileCache.destroy();
  result.navMesh.destroy();
}

/** @param {string} mapKey  */
async function createNavTileByTile(mapKey) {
  const { meshes, customAreaDefs } = await computeGeomorphMeshes(mapKey);
  
  await initRecastNav();
  
  // 1st mesh only
  const result = customThreeToTileCache(
    meshes.slice(0, 1),
    getTileCacheGeneratorConfig(getBasicTileCacheMeshProcess()),
    { areas: customAreaDefs[0] },
  );

  if (!result.success) {
    error(`Failed to compute navMesh: ${'error' in result ? result.error : 'unknown error'}`);
    meshes.forEach((mesh) => mesh.geometry.dispose());
    return;
  }
  
  // 🚧 add tiles
  // result.tileCache.addTile()


  meshes.forEach((mesh) => mesh.geometry.dispose());
}

/** @param {string} mapKey  */
async function computeGeomorphMeshes(mapKey) {
  const geomorphs = geomorph.deserializeGeomorphs(await fetchGeomorphsJson());
  const map = geomorphs.map[mapKey ?? "demo-map-1"];
  const gms = map.gms.map(({ gmKey, transform }, gmId) =>
    geomorph.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
  );

  const customAreaDefs = /** @type {NPC.TileCacheConvexAreaDef[][]} */ (gms.map(() => []));

  const meshes = gms.map(({ key, navDecomp, navDoorwaysOffset, mat4, transform: [a, b, c, d, e, f] }, gmId) => {
    const determinant = a * d - b * c;
    const mesh = new THREE.Mesh(decompToXZGeometry(navDecomp, { reverse: determinant === 1 }));
    mesh.applyMatrix4(mat4);
    mesh.updateMatrixWorld();
    
    const { tris, vs, tris: { length } } = navDecomp;
    const allVerts = vs.map(v => (new THREE.Vector3(v.x, 0, v.y)).applyMatrix4(mat4));
    for (let i = navDoorwaysOffset; i < length; i++) {
      customAreaDefs[gmId].push({
        areaId: 1,
        areas: [ { hmin: 0, hmax: 0.02, verts: tris[i].map(id => allVerts[id]) }],
      });
    }

    return mesh;
  });

  debug('🤖 nav.worker', {
    'total vertices': meshes.reduce((agg, mesh) => agg + (mesh.geometry.getAttribute('position')?.count ?? 0), 0),
    'total triangles': meshes.reduce((agg, mesh) => agg + (mesh.geometry.index?.count ?? 0) / 3, 0),
    'total meshes': meshes.length,
  });

  return { meshes, customAreaDefs };
}


/**
 * 
 * @param {import('recast-navigation').NavMesh} navMesh 
 */
function logTileCount(navMesh) {
  const polysPerTile = range(navMesh.getMaxTiles()).flatMap((i) =>
    navMesh.getTile(i).header()?.polyCount() ?? []
  );
  info('🤖 nav.worker', { totalTiles: polysPerTile.length, polysPerTile });
}
