import { queryClient } from "./query-client";
import { info, isDevelopment } from "./generic";

/** See `npm run develop` */
export const DEV_GATSBY_PORT = 8011;

/** See `npm run ws-server` */
export const DEV_EXPRESS_WEBSOCKET_PORT = 8012;

/**
 * 🔔🔔🔔
 * Change for local mobile debugging, e.g. via:
 * `ifconfig | grep "inet " | grep -v 127.0.0.1`
*/
export const DEV_ORIGIN = 'localhost';
// export const DEV_ORIGIN = '192.168.16.66';
// export const DEV_ORIGIN = '192.168.59.66';
// export const DEV_ORIGIN = '192.168.219.66';

/**
 * - Parsed JSON stored at `static/assets/${ASSETS_META_JSON_FILENAME}`
 * - Also a react-query `queryKey`.
 */
export const ASSETS_JSON_FILENAME = "assets.json";

/**
 * Gatsby serves `static/assets/*` in development as `/assets/*`.
 * However, it can be slow to update.
 * In development we serve assets directly to overcome this.
 */
export const assetsEndpoint = process.env.NODE_ENV === 'development'
  ? `http://${DEV_ORIGIN}:${DEV_EXPRESS_WEBSOCKET_PORT}/dev-assets`
  : '/assets'
;

export const GEOMORPHS_JSON_FILENAME = "geomorphs.json";

export const imgExt = isDevelopment() ? 'png' : 'png.webp';


/** @returns {Promise<Geomorph.GeomorphsJson>} */
export async function fetchGeomorphsJson() {
  return await fetch(
    `${assetsEndpoint}/${GEOMORPHS_JSON_FILENAME}${getDevCacheBustQueryParam()}`
  ).then((x) => x.json());
}

/** @param {number} sheetId */
export function getObstaclesSheetUrl(sheetId) {
  return `${assetsEndpoint}/2d/obstacles.${sheetId}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** @param {number} sheetId */
export function getDecorSheetUrl(sheetId) {
  return `${assetsEndpoint}/2d/decor.${sheetId}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** @param {Geomorph.DecorImgKey} decorImgKey */
export function getDecorIconUrl(decorImgKey) {
  return `${assetsEndpoint}/2d/${decorImgKey}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** Override cache in development */
function getDevCacheBustQueryParam() {
  return isDevelopment() ? `?v=${Date.now()}` : '';
}

export const WORLD_QUERY_FIRST_KEY = 'world';

/**
 * Dev-only event handling:
 * > trigger component refresh on file change
 */
export function connectDevEventsWebsocket() {
  const url = `ws://${DEV_ORIGIN}:${DEV_EXPRESS_WEBSOCKET_PORT}/dev-events`;
  const wsClient = new WebSocket(url);
  wsClient.onmessage = async (e) => {
    info(`received websocket message:`, { url, data: e.data });

    queryClient.refetchQueries({
      predicate({ queryKey: [queryKey] }) {
        return WORLD_QUERY_FIRST_KEY === queryKey;
      },
    });
  };

  wsClient.onopen = (_e) => {
    info(`${url} connected`);
    wsAttempts = 0;
  };
  wsClient.onclose = (_e) => {
    info(`${url} closed: reconnecting...`);
    if (++wsAttempts <= 5) {
      setTimeout(connectDevEventsWebsocket, (2 ** wsAttempts) * 300);
    } else {
      info(`${url} closed: gave up reconnecting`);
    }
  };
}

let wsAttempts = 0;
