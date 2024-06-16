import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faHomeUser,
  // faCirclePause,
  // faRefresh,
  // faExpand,
  // faPause,
} from "@fortawesome/free-solid-svg-icons";

export const HomeIcon = () => <FontAwesomeIcon icon={faHomeUser} size="1x" style={{ filter: 'invert(0.5)' }} /> 

/**
 * Manually constructed using Boxy SVG and https://www.svgminify.com/
 */
export const faExpandThin = {
  icon: [
    448,
    512,
    [],
    "f065",
    "m472 352 2e-3 96.162c0.368 7.094-2.157 12.259-7.086 16.885-4.609 4.92-9.806 7.312-16.916 6.953l-96.162 2e-3c-7.093 0.368-12.264-2.163-16.89-7.091-4.887-4.538-6.948-9.649-6.948-16.911 0-7.253 2.193-12.5 7.084-17.046 4.609-4.92 9.804-7.311 16.916-6.954h72v-2l-2e-3 -70.162c-0.368-7.093 2.163-12.264 7.091-16.89 4.538-4.887 9.649-6.948 16.911-6.948 7.253 0 12.5 2.193 17.046 7.084 4.921 4.609 7.313 9.806 6.954 16.916zm-120-312 96.162-2e-3c7.094-0.368 12.259 2.157 16.885 7.086 4.92 4.609 7.312 9.806 6.953 16.916l2e-3 96.162c0.368 7.093-2.163 12.264-7.091 16.89-4.538 4.887-9.649 6.948-16.911 6.948-7.253 0-12.5-2.193-17.046-7.084-4.92-4.609-7.311-9.804-6.954-16.916v-72h-2l-70.162 2e-3c-7.093 0.368-12.264-2.163-16.89-7.091-4.887-4.538-6.948-9.649-6.948-16.911 0-7.253 2.193-12.5 7.084-17.046 4.609-4.92 9.804-7.311 16.916-6.954zm-264 312v72h2l70.162-2e-3c7.093-0.368 12.264 2.163 16.89 7.091 4.887 4.538 6.948 9.649 6.948 16.911 0 7.253-2.193 12.5-7.084 17.046-4.609 4.921-9.806 7.313-16.916 6.954l-96.162 2e-3c-7.094 0.368-12.259-2.157-16.884-7.086-4.92-4.609-7.311-9.804-6.954-16.916l-2e-3 -96.162c-0.368-7.093 2.163-12.264 7.091-16.89 4.538-4.887 9.649-6.948 16.911-6.948 7.253 0 12.5 2.193 17.046 7.084 4.921 4.609 7.313 9.806 6.954 16.916zm-24-312 96.162-2e-3c7.093-0.368 12.264 2.163 16.89 7.091 4.887 4.538 6.948 9.649 6.948 16.911 0 7.253-2.193 12.5-7.084 17.046-4.609 4.921-9.806 7.313-16.916 6.954h-72v2l2e-3 70.162c0.368 7.093-2.163 12.264-7.091 16.89-4.538 4.887-9.649 6.948-16.911 6.948-7.253 0-12.5-2.193-17.046-7.084-4.92-4.609-7.311-9.804-6.954-16.916l-2e-3 -96.162c-0.368-7.094 2.157-12.259 7.086-16.884 4.609-4.92 9.804-7.311 16.916-6.954z",
  ],
  prefix: "fas" as const,
  iconName: "expand" as const,
};

export const faRefreshThin = {
  icon: [
    512,
    512,
    [128472, "refresh", "sync"],
    "f021",
    "m45.279 301.19c1.177-0.155 1.974-0.202 3.132-0.189l112.12-0.016c5.77-0.617 9.117 1.303 13.019 5.673l0.074 0.08 0.011 0.01 0.065 0.054-0.015-0.012c4.238 3.6 5.311 6.861 5.311 13.211 0 6.29-1.38 9.866-5.612 13.51l-0.086 0.075-0.041 0.047-0.037 0.043c-3.801 4.327-7.404 5.886-13.275 5.325h-65.731l39.451 39.451c33.47 32.686 78.982 50.624 122.28 50.624 43.3 0 88.888-18.019 122.36-50.699 18.54-18.706 32.726-42.133 41.001-65.125l-0.015 0.067 5e-3 -0.02 2e-3 -6e-3 0.012-0.051c1e-3 -2e-3 1e-3 -4e-3 2e-3 -5e-3l-2e-3 4e-3c1.337-5.582 4.317-8.136 9.712-10.375l-0.049 0.049 0.115-0.066 0.1-0.058c4.991-2.817 8.758-3.111 14.132-0.654l0.194 0.083 0.12 0.033 0.1 0.026 0.025 8e-3c5.683 1.436 8.29 4.376 10.493 9.768l0.022 0.051 0.015 0.028 0.011 0.02c2.821 5.021 3.146 8.861 0.629 14.243l-4e-3 7e-3 -4e-3 0.012c-10.199 29.329-26.424 55.624-49.863 78.838-41.414 42.168-94.057 61.697-149.08 61.697-55.021 0-107.8-19.589-149.23-61.775l-39.756-39.54v16.835l0.016 50.065c0.617 5.77-1.302 9.116-5.673 13.019l-0.078 0.072-0.013 0.015-0.049 0.057 8e-3 -9e-3c-3.6 4.239-6.861 5.311-13.211 5.311-6.289 0-9.864-1.381-13.509-5.612l-0.078-0.088-0.045-0.041-0.042-0.036c-4.327-3.802-5.886-7.402-5.326-13.274v-111.62c-0.014-1.243 0.081-2.336 0.272-3.217l-7e-3 0.061 4e-3 -0.036c1e-3 -9e-3 2e-3 -0.018 3e-3 -0.028 2e-3 -5e-3 3e-3 -0.01 4e-3 -0.015l-3e-3 0.012c0.084-0.684 0.293-1.49 0.569-2.592 0.723-3.498 1.955-5.45 4.798-7.988l0.124-0.114 0.014-0.016 0.028-0.033 0.056-0.065 0.034-0.039c2.136-2.618 4.394-3.612 8.138-4.612l-0.045 0.012 0.608-0.308 0.188-0.018 0.186-0.018c0.216-0.021 0.62-0.051 1.308-0.13zm37.525-91.878c-4.993 2.816-8.773 3.102-14.14 0.648l-0.162-0.067-0.066-0.02-0.044-0.013-0.032-9e-3 -0.172-0.048c-5.649-1.437-8.243-4.364-10.446-9.756l-0.022-0.051-8e-3 -0.013-8e-3 -0.016c-2.828-5.022-3.144-8.898-0.633-14.272l-0.021 0.062 3e-3 -9e-3 0.019-0.056c2e-3 -3e-3 3e-3 -6e-3 5e-3 -0.01l-4e-3 9e-3v-1e-3c10.204-29.447 26.317-55.727 49.752-78.93 41.465-42.218 94.146-61.784 149.18-61.784 55.033 0 107.76 19.559 149.19 61.796l39.711 39.941v-16.968l-0.016-50.279c-0.617-5.77 1.302-9.116 5.673-13.019l0.08-0.074 0.01-0.011 0.054-0.064-0.012 0.014c3.6-4.238 6.861-5.311 13.211-5.311 6.289 0 9.865 1.381 13.51 5.612l0.077 0.088 0.046 0.041 0.042 0.036c4.326 3.802 5.887 7.404 5.325 13.274l0.016 112.47-8e-3 -0.064 6e-3 0.061c0.624 5.782-1.329 9.17-5.717 13.085l-0.04 0.035-0.021 0.024c-3.806 4.338-7.417 5.902-13.287 5.34l-112.38 0.016c-5.77 0.617-9.116-1.302-13.019-5.673l-0.074-0.08-0.011-0.01-0.065-0.054 0.015 0.012c-4.238-3.6-5.311-6.861-5.311-13.211 0-6.29 1.38-9.866 5.612-13.51l0.089-0.079 0.042-0.045 0.034-0.04c3.801-4.326 7.402-5.886 13.274-5.326h65.501l-22.035-22.165-17.188-17.288c-33.469-32.684-78.98-50.622-122.28-50.622-43.3 0-88.888 18.021-122.36 50.7-18.542 18.704-32.577 41.651-40.851 64.655l-0.739 2.095v0.16l-0.052 0.155-0.046 0.137c-1.553 4.309-4.308 6.444-9.107 8.44l-0.041 0.016 0.066-0.039-0.098 0.057z",
  ],
  iconName: "arrows-rotate" as const,
  prefix: "fas" as const,
};

export const faCirclePauseThin = {
  icon: [
    512,
    512,
    [62092, "pause-circle"],
    "f28b",
    "M 34.297 384 C -64.237 213.333 58.931 0 256 0 C 347.46 0 431.973 48.793 477.703 128 C 576.237 298.667 453.069 512 256 512 C 164.54 512 80.027 463.207 34.297 384 Z M 256 474 C 344.129 474 407.582 433.436 444.579 365.383 C 485.041 298.977 491.735 221.723 445.129 147.564 C 406.667 75.66 338.137 38 256 38 C 167.871 38 104.418 78.564 67.422 146.617 C 26.959 213.022 20.265 290.276 66.871 364.436 C 105.334 436.34 173.862 474 256 474 Z M 214 192 L 214 320 C 214 337.7 209.7 352 192 352 C 174.3 352 170 337.7 170 320 L 170 192 C 170 174.3 174.3 160 192 160 C 209.7 160 214 174.3 214 192 Z M 342 192 L 342 320 C 342 337.7 337.7 352 320 352 C 302.3 352 298 337.7 298 320 L 298 192 C 298 174.3 302.3 160 320 160 C 337.7 160 342 174.3 342 192 Z",
  ],
  prefix: "fas" as const,
  iconName: "circle-pause" as const,
};

export { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export {
  faCoffee,
  faChevronRight,
  faLungs,
  faCompress,
  faRobot,
  faCode,
  faCircleQuestion,
  faCircleInfo,
  faGrip,
  faHome,
  faHomeAlt,
  faHomeUser,
  // faCirclePause,
  // faRefresh,
  // faExpand,
  // faPause,
} from "@fortawesome/free-solid-svg-icons";
