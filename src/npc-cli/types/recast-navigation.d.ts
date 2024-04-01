export * from "@recast-navigation/core";

import type TC from '@recast-navigation/core/dist/tile-cache';

declare module "@recast-navigation/core" {
  
  type ObstacleRef = TC.ObstacleRef & {
    ptr: number;
  }

  type Obstacle = TC.Obstacle & {
    ref: ObstacleRef;
  };
  
}
