declare namespace NPC {
  type Event =
    | PointerUpOutsideEvent
    | PointerUpEvent
    | PointerDownEvent
    | LongPointerDownEvent
    // | PointerMoveEvent
    | { key: "disabled" }
    | { key: "enabled" }
    | { key: "spawned-npc"; npcKey: string }
    | { key: "removed-npc"; npcKey: string }
    | { key: "draw-floor-ceil"; gmKey: Geomorph.GeomorphKey };
    // 🚧 ...

  type PointerUpEvent = Pretty<BasePointerEvent & {
    key: "pointerup";
  }>;

  type PointerUpOutsideEvent = Pretty<BasePointerEvent & {
    key: "pointerup-outside";
    is3d: false;
  }>;

  type PointerDownEvent = Pretty<BasePointerEvent & {
    key: "pointerdown";
  }>;
  
  interface LongPointerDownEvent {
    key: "long-pointerdown";
    /** Distance in screen pixels from pointerdown */
    distancePx: number;
    screenPoint: Geom.VectJson;
  }

  type BasePointerEvent = {
    /** For future use with CLI */
    clickId?: string;
    /**
     * Distance in screen pixels from previous pointerdown.
     * Only for `pointerup`.
    */
    distancePx: number;
    /**
      * Was previous pointerdown held down for long?
      * Only for `pointerup`.
      */
    justLongDown: boolean;
    /** Screen position of pointer */
    screenPoint: Geom.VectJson;
    /** Was the right mouse button being pressed?  */
    rmb: boolean;
  } & (
    | {
        is3d: true;
        point: import("three").Vector3Like;
        /** Properties of the thing we clicked. */
        meta: Geom.Meta<{
          /** `(x, z)` of target element centre if any */
          targetCenter?: Geom.VectJson;
        }>;
      }
    | { is3d: false; }
  );

  type TiledCacheResult = Extract<
    import("@recast-navigation/core").NavMeshImporterResult,
    { tileCache?: any }
  >;

  interface TileCacheConvexAreaDef {
    areaId: number;
    areas: {
      /** Must define a convex polygon */
      verts: import("three").Vector3Like[];
      hmin: number;
      hmax: number;
    }[];
  }

  type CrowdAgent = import("@recast-navigation/core").CrowdAgent;

  type Obstacle = {
    id: number;
    o: import("@recast-navigation/core").Obstacle;
    mesh: THREE.Mesh;
  };

  type ObstacleRef = import("@recast-navigation/core").ObstacleRef;

}
