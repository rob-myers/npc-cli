import { TileCacheMeshProcess } from "@recast-navigation/core";

/**
 * https://github.com/isaac-mason/recast-navigation-js/blob/d64fa867361a316b53c2da1251820a0bd6567f82/packages/recast-navigation-generators/src/generators/generate-tile-cache.ts#L108
 */
export function getTileCacheMeshProcess() {
  return new TileCacheMeshProcess((navMeshCreateParams, polyAreas, polyFlags) => {
    // info({
    //   polyCount: navMeshCreateParams.polyCount(),
    //   vertCount: navMeshCreateParams.vertCount(),
    // });
    for (let i = 0; i < navMeshCreateParams.polyCount(); ++i) {
      polyAreas.set(i, 0);
      // polyFlags.set(i, 1);
      polyFlags.set(i, 2 ** 1); // walkable ~ 2nd lsb bit high
    }
  });
}

/** @returns {Partial<import("@recast-navigation/generators").TileCacheGeneratorConfig>} */
export function getTileCacheGeneratorConfig() {
  return {
    tileSize: 30,
    cs: 0.05,
    // ch: 0.0001,
    ch: Number.EPSILON,
    borderSize: 0,
    expectedLayersPerTile: 1,
    detailSampleDist: 0,
    walkableClimb: 0,
    tileCacheMeshProcess: getTileCacheMeshProcess(),
  };
}
