export const localStorageKey = {
  touchTtyCanType: "touch-tty-can-type",
  touchTtyOpen: "touch-tty-open",
};

export const zIndex = /** @type {const} */ ({
  ttyTouchHelper: 5,
});

/**
 * Convert Starship Geomorph units (sgu) into world coordinates (meters).
 * e.g. 1 tile is 60 sgu, which becomes 1.5 meters
 */
export const worldScale = (1 / 60) * 1.5;

/** Decimal place precision */
export const precision = 4;

export const wallOutset = 12 * worldScale;

export const obstacleOutset = 12 * worldScale;

export const agentRadius = 12 * worldScale;

export const wallHeight = 2;
