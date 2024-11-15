import { TileCacheMeshProcess } from "@recast-navigation/core";
import { Vect } from "../geom";
import { wallOutset } from "./const";

/**
 * https://github.com/isaac-mason/recast-navigation-js/blob/d64fa867361a316b53c2da1251820a0bd6567f82/packages/recast-navigation-generators/src/generators/generate-tile-cache.ts#L108
 * @param {Geomorph.LayoutInstance[]} gms
 */
export function getGeomorphsTileCacheMeshProcess(gms) {
  const offMeshConnectionDefs = getTestDoorwayOffMeshConnections(gms);

  return new TileCacheMeshProcess((navMeshCreateParams, polyAreas, polyFlags) => {
    for (let i = 0; i < navMeshCreateParams.polyCount(); ++i) {
      polyAreas.set(i, 0);
      // polyFlags.set(i, 1);
      polyFlags.set(i, 2 ** 1); // walkable ~ 2nd lsb bit high
    }
    navMeshCreateParams.setOffMeshConnections(offMeshConnectionDefs);
  });
}

/**
 * 🤔 off-mesh-connections on hold:
 * - somewhat unnatural motion
 * - fiddly to manual set speed
 * https://github.com/isaac-mason/recast-navigation-js/blob/d64fa867361a316b53c2da1251820a0bd6567f82/packages/recast-navigation-generators/src/generators/generate-tile-cache.ts#L108
 * @param {Geomorph.LayoutInstance[]} gms
 */
function getTestDoorwayOffMeshConnections(gms) {
  /** @type {import("@recast-navigation/core").OffMeshConnectionParams[]} */
  const offMeshConnectionDefs = [];
  
  return offMeshConnectionDefs;

  const center = new Vect();
  const normal = new Vect();
  const halfDepth = wallOutset * 1.5;
  // one connection per non-hull door
  for (const gm of gms) {
    for (const door of gm.doors) {
      if (door.meta.hull) {
        continue;
      }
      gm.matrix.transformPoint(center.copy(door.center));
      gm.matrix.transformSansTranslate(normal.copy(door.normal));
      offMeshConnectionDefs.push({
        bidirectional: true,
        startPosition: {
          x: center.x + halfDepth * door.normal.x,
          y: 0.01,
          z: center.y + halfDepth * door.normal.y,
        },
        endPosition: {
          x: center.x - halfDepth * door.normal.x,
          y: 0.01,
          z: center.y - halfDepth * door.normal.y,
        },
        radius: 0.1,
        area: 0, // 🚧
        flags: 1, // 🚧
      });
    }
  }

  return offMeshConnectionDefs;
}
