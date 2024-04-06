import { TileCacheMeshProcess } from "@recast-navigation/core";
import { getPositionsAndIndices } from "@recast-navigation/three";
import { generateTileCache } from "@recast-navigation/generators";
import * as THREE from "three";

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
    cs: 0.05, // Small `cs` means more tileCache updates when e.g. add obstacles
    ch: 0.0001, // EPSILON breaks obstacles
    borderSize: 0,
    expectedLayersPerTile: 1,
    detailSampleDist: 0,
    walkableClimb: 0,
    tileCacheMeshProcess: getTileCacheMeshProcess(),
    // maxSimplificationError: 0,
  };
}

/**
 * 
 * @param {THREE.Mesh[]} meshes 
 * @param {Partial<import("@recast-navigation/generators").TileCacheGeneratorConfig>} navMeshGeneratorConfig 
 */
export function customThreeToTileCache(
  meshes,
  navMeshGeneratorConfig = {},
  keepIntermediates = false  
) {

  const [positions, indices] = getPositionsAndIndices(meshes);

  return generateTileCache(
    positions,
    indices,
    navMeshGeneratorConfig,
    keepIntermediates
  );
}