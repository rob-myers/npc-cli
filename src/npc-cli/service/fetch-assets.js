import { GEOMORPHS_JSON_FILENAME, assetsEndpoint, imgExt } from "src/const"; // 🚧 -> npc-cli/service/const
import { isDevelopment } from "./generic";

/** @returns {Promise<Geomorph.GeomorphsJson>} */
export async function fetchGeomorphsJson() {
  return await fetch(
    `${assetsEndpoint}/${GEOMORPHS_JSON_FILENAME}${getDevCacheBustQueryParam()}`
  ).then((x) => x.json());
}

export function getObstaclesSheetUrl() {
  return `${assetsEndpoint}/2d/obstacles.${imgExt}${getDevCacheBustQueryParam()}`;
}

export function getDecorSheetUrl() {
  return `${assetsEndpoint}/2d/decor.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** Override cache in development */
function getDevCacheBustQueryParam() {
  return isDevelopment() ? `?v=${Date.now()}` : '';
}
