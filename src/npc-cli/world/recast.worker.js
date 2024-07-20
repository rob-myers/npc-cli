import * as THREE from "three";
import { init as initRecastNav, exportNavMesh } from "@recast-navigation/core";

import { alloc, error, info } from "../service/generic";
import { geomorphService } from "../service/geomorph";
import { decompToXZGeometry, polysToXZGeometry } from "../service/three";
import { customThreeToTileCache, getTileCacheGeneratorConfig } from "../service/recast-detour";
import { fetchGeomorphsJson } from "../service/fetch-assets";

info("nav worker started", import.meta.url);

const selfTyped = /** @type {WW.WorkerGeneric<WW.MessageFromNavWorker, WW.MessageToNavWorker>} */ (
  /** @type {*} */ (self)
);

selfTyped.addEventListener("message", handleMessages);

/** @param {MessageEvent<WW.MessageToNavWorker>} e */
async function handleMessages(e) {
  const msg = e.data;
  info("worker received message", msg);

  switch (msg.type) {
    case "request-nav-mesh":
      const geomorphs = geomorphService.deserializeGeomorphs(await fetchGeomorphsJson());

      const { mapKey } = msg;
      const map = geomorphs.map[mapKey ?? "demo-map-1"];
      const gms = map.gms.map(({ gmKey, transform }, gmId) =>
        geomorphService.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
      );

      const customAreaDefs = /** @type {NPC.TileCacheConvexAreaDef[]} */ ([]);
      const meshes = gms.map(({ navDecomp, navDoorwaysOffset, mat4, transform: [a, b, c, d, e, f] }, gmId) => {
        const determinant = a * d - b * c;
        // const mesh = new THREE.Mesh(polysToXZGeometry(navPolys, { reverse: determinant === 1 }));
        const mesh = new THREE.Mesh(decompToXZGeometry(navDecomp, { reverse: determinant === 1 }));
        mesh.applyMatrix4(mat4);
        mesh.updateMatrixWorld();
        
        // 🚧 hard-coded area, height
        const { tris, vs, tris: { length: numTris }  } = navDecomp;
        const allVerts = vs.map(v => (new THREE.Vector3(v.x, 0, v.y)).applyMatrix4(mat4))
        for (let i = navDoorwaysOffset; i < numTris; i++) {
          customAreaDefs.push({ areaId: 1, areas: [
            { hmin: 0, hmax: 0.02, verts: tris[i].map(id => allVerts[id]) },
          ]});
        }
        return mesh;
      });

      info('total vertices', meshes.reduce((agg, mesh) => agg + (mesh.geometry.getAttribute('position')?.count ?? 0), 0));
      info('total triangles', meshes.reduce((agg, mesh) => agg + (mesh.geometry.index?.count ?? 0) / 3, 0));
      info('total meshes', meshes.length);

      await initRecastNav();
      const result = customThreeToTileCache(
        meshes,
        getTileCacheGeneratorConfig(),
        { areas: customAreaDefs },
      );
      
      if (result.success) {
        const { navMesh, tileCache } = result;
        const tilePolyCounts = alloc(navMesh.getMaxTiles()).flatMap((_, i) =>
          navMesh.getTile(i).header()?.polyCount() ?? []
        );
        info('total tiles', tilePolyCounts.length, { tilePolyCounts });

        selfTyped.postMessage({
          type: "nav-mesh-response",
          mapKey,
          exportedNavMesh: exportNavMesh(navMesh, tileCache),
        });

        tileCache.destroy();
        navMesh.destroy();
      } else {
        error(`Failed to compute navMesh: ${'error' in result ? result.error : 'unknown error'}`);
      }

      meshes.forEach((mesh) => mesh.geometry.dispose());
      break;
    default:
      info("nav worker: unhandled:", msg);
      break;
  }
}
