declare namespace NPC {
  type Event =
    | PointerUpOutsideEvent
    | PointerUpEvent
    | PointerMoveEvent
    | { key: "disabled" }
    | { key: "enabled" }
    | { key: "spawned-npc"; npcKey: string }
    | { key: "removed-npc"; npcKey: string };
  // ...

  interface PointerMoveEvent {
    key: "pointermove";
    /** Ordinate `y` */
    height: number;
    /** Properties of the thing we clicked. */
    meta: Geom.Meta;
    /** Coords `(x, z)` */
    point: Geom.VectJson;
    screenPoint: Geom.VectJson;
  }

  interface PointerUpEvent extends BasePointerUpEvent {
    key: "pointerup";
    point: import("three").Vector3Like;
    /** Properties of the thing we clicked. */
    meta: Geom.Meta<{
      /** `(x, z)` of target element centre if any */
      targetCenter?: Geom.VectJson;
    }>;
  }

  interface PointerUpOutsideEvent extends BasePointerUpEvent {
    key: "pointerup-outside";
  }

  interface BasePointerUpEvent {
    /** 🚧 */
    clickId?: string;
    /** Distance in XZ plane from pointerdown */
    distance: number;
    /** Was this a long press? */
    longPress: boolean;
    /** Was the right mouse button used?  */
    rmb: boolean;
    screenPoint: Geom.VectJson;
  }

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
