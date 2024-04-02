export const localStorageKey = {
  touchTtyCanType: "touch-tty-can-type",
  touchTtyOpen: "touch-tty-open",
};

export const zIndex = /** @type {const} */ ({
  ttyTouchHelper: 5,
});

/**
 * `1/60` -> 1 grid side -> `1.5m`
 */
export const worldScale = (1 / 60) * 1.5;

/** Decimal place precision */
export const precision = 4;

export const wallOutset = 12 * worldScale;

export const obstacleOutset = 12 * worldScale;

export const agentRadius = wallOutset;

export const wallHeight = 2;
