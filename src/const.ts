/** See `npm run develop` */
export const DEV_GATSBY_PORT = 8011;

/** See `npm run ws-server` */
export const DEV_EXPRESS_WEBSOCKET_PORT = 8012;

/**
 * - Parsed JSON stored at `static/assets/${ASSETS_META_JSON_FILENAME}`
 * - Also a react-query `queryKey`.
 */
export const ASSETS_JSON_FILENAME = "assets.json";

export const GEOMORPHS_JSON_FILENAME = "geomorphs.json";

export const DEV_ORIGIN = 'localhost';
/**
 * For local mobile debugging, e.g. via:
 * `ifconfig | grep "inet " | grep -v 127.0.0.1`
 */
// export const DEV_ORIGIN = '192.168.16.66';

/**
 * Gatsby serves `static/assets/*` in development as `/assets/*`.
 * However, it can be slow to update.
 * In development we serve assets directly to overcome this.
 */
export const assetsEndpoint = process.env.NODE_ENV === 'development'
  ? `http://${DEV_ORIGIN}:${DEV_EXPRESS_WEBSOCKET_PORT}/dev-assets`
  : '/assets'
;

export const imgExt = process.env.NODE_ENV === 'development' ? 'png' : 'png.webp';

export const afterBreakpoint = "1201px";
export const breakpoint = "1200px";

export const discussionsUrl = "https://github.com/rob-myers/npc-cli/discussions";

export const nav = /** @type {const} */ {
  collapsedRem: 4,
  collapsedWidth: "4rem",
  expandedRem: 15,
  expandedWidth: "15rem",
  titleMarginTop: "0.5rem",
};

export const view = /** @type {const} */ {
  /** Small viewport: height; Large viewport: width */
  barSize: "4rem",
  /** Small viewport: width; Large viewport: height */
  iconSize: "3.5rem",
};
