import * as THREE from "three";
import { init as initRecastNav, exportTileCache } from "@recast-navigation/core";

import { error, info, debug, warn, removeDups, range } from "../service/generic";
import { geomorph } from "../service/geomorph";
import { customThreeToTileCache, getTileCacheGeneratorConfig, getBasicTileCacheMeshProcess, computeGmInstanceMesh } from "../service/recast-detour";
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
  debug("🤖 nav.worker received", JSON.stringify(msg.type));

  if (msg.type === 'request-nav') {
    onRequestNav(msg.mapKey);
  }

}

/** @param {string} mapKey  */
async function onRequestNav(mapKey) {
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
async function computeGeomorphMeshes(mapKey) {
  const geomorphs = geomorph.deserializeGeomorphs(await fetchGeomorphsJson());
  const map = geomorphs.map[mapKey ?? "demo-map-1"];
  const gms = map.gms.map(({ gmKey, transform }, gmId) =>
    geomorph.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
  );

  const meshes = /** @type {THREE.Mesh[]} */ ([]);
  const customAreaDefs = /** @type {NPC.TileCacheConvexAreaDef[]} */ ([]);
  gms.map(computeGmInstanceMesh).forEach((x) => {
    meshes.push(x.mesh);
    customAreaDefs.push(...x.customAreaDefs);
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
