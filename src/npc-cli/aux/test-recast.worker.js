import * as THREE from "three";
import {
  NavMeshHelper,
  threeToSoloNavMesh,
  threeToTiledNavMesh,
  threeToTileCache,
} from "@recast-navigation/three";
import { init as initRecastNav, exportNavMesh } from "@recast-navigation/core";
import { tileCacheGeneratorConfigDefaults } from "@recast-navigation/generators";

import { GEOMORPHS_JSON_FILENAME } from "src/scripts/const";
import { error, info } from "../service/generic";
import { geomorphService } from "../service/geomorph";
import { polysToXZGeometry } from "../service/three";
import { getTileCacheMeshProcess } from "../service/recast-detour";

info("web worker started", import.meta.url);

const selfTyped = /** @type {WW.WorkerGeneric<WW.MessageFromWorker, WW.MessageToWorker>} */ (
  /** @type {*} */ (self)
);

selfTyped.addEventListener("message", handleMessages);

/** @param {MessageEvent<WW.MessageToWorker>} e */
async function handleMessages(e) {
  const msg = e.data;
  info("worker received message", msg);

  switch (msg.type) {
    case "request-nav-mesh":
      const geomorphs = await ensureGeomorphs();

      const { mapKey } = msg;
      const map = geomorphs.map[mapKey ?? "demo-map-1"];
      const gms = map.gms.map(({ gmKey, transform = [1, 0, 0, 1, 0, 0] }, gmId) =>
        geomorphService.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
      );
      const meshes = gms.map(({ navPolys, mat4, transform: [a, b, c, d] }, gmId) => {
        const determinant = a * d - b * c;
        const mesh = new THREE.Mesh(polysToXZGeometry(navPolys, { reverse: determinant === 1 }));
        mesh.applyMatrix4(mat4);
        mesh.updateMatrixWorld();
        return mesh;
      });

      info('total vertices', meshes.reduce((agg, mesh) => agg + (mesh.geometry.getAttribute('position')?.count ?? 0), 0));
      info('total triangles', meshes.reduce((agg, mesh) => agg + (mesh.geometry.index?.count ?? 0) / 3, 0));

      await initRecastNav();
      // const { navMesh, success } = threeToSoloNavMesh(meshes, {});
      // const { navMesh, success } = threeToTiledNavMesh(meshes, {
      //   tileSize: 30,
      // });
      
      // console.log({ tileCacheGeneratorConfigDefaults })
      const { navMesh, tileCache, success } = threeToTileCache(meshes, {
        tileSize: 30,
        ch: 0.0001,
        borderSize: 0,
        expectedLayersPerTile: 1,
        detailSampleDist: 0,
        walkableClimb: 0,
        tileCacheMeshProcess: getTileCacheMeshProcess(),
      });
      info({ numMeshes: meshes.length, navMesh, success });

      if (navMesh && tileCache) {
        const exportedNavMesh = exportNavMesh(navMesh, tileCache);
        /** @type {WW.MessageFromWorker} */
        const msg = { type: "nav-mesh-response", mapKey, exportedNavMesh };
        self.postMessage(msg);
      } else {
        error("failed to compute navMesh");
      }

      meshes.forEach((mesh) => mesh.geometry.dispose());
      break;
    default:
      info("unhandled message", msg);
      break;
  }
}

async function ensureGeomorphs() {
  return (cache.geomorphs ??= geomorphService.deserializeGeomorphs(
    await fetch(`/assets/${GEOMORPHS_JSON_FILENAME}`).then((x) => x.json())
  ));
}

/** @type {{ geomorphs: Geomorph.Geomorphs }} */
const cache = {
  geomorphs: /** @type {*} */ (null),
};
