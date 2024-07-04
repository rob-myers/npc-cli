declare namespace Geomorph {
  interface AssetsGeneric<
    T extends Geom.GeoJsonPolygon | Geom.Poly,
    P extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect
  > {
    symbols: Record<Geomorph.SymbolKey, Geomorph.SymbolGeneric<T, P, R>>;
    maps: Record<string, Geomorph.MapDef>;
    sheet: SpriteSheet;
    /** `metaKey` is a `Geomorph.SymbolKey` or a mapKey e.g. `demo-map-1` */
    meta: { [metaKey: string]: {
      /** Hash of parsed symbol */
      outputHash: number;
      /** Hash of `"data:image/png..."` (including quotes) */
      pngHash?: number;
      /** Hash of each obstacle polygon */
      obsHashes?: number[];
    } };
  }

  type AssetsJson = AssetsGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;
  type Assets = AssetsGeneric<Geom.Poly, Geom.Vect, Geom.Rect>;

  type Connector = import("../service/geomorph").Connector;

  interface ConnectorJson {
    poly: Geom.GeoJsonPolygon;
    /**
     * `[id of room infront, id of room behind]`
     * where a room is *infront* if `normal` is pointing towards it.
     * Hull doors have exactly one non-null entry.
     */
    roomIds: [null | number, null | number];
  }

  interface DoorMeta extends Geomorph.GmDoorId {
    /** gmDoorKey format i.e. `g{gmId}d{doorId}` */
    key: `g${number}d${number}`;
    door: Geomorph.Connector;
    instanceId: number;
    /** Is the door open? */
    open: boolean;
    /** Between `0.1` (open) and `1` (closed) */
    ratio: number;
    /** Source of transformed door segment */
    src: Geom.VectJson;
    /** Direction of transformed door segment */
    dir: Geom.VectJson;
    normal: Geom.VectJson;
    /** Length of `door.seg` */
    segLength: number;
  }

  interface GeomorphsGeneric<
    T extends Geom.GeoJsonPolygon | Geom.Poly,
    P extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect,
    C extends Geomorph.Connector | Geomorph.ConnectorJson
  > {
    /** `${mapsHash} ${layoutsHash} ${sheetsHash} ${imagesHash}` */
    hash: string;
    mapsHash: number;
    layoutsHash: number;
    sheetsHash: number;
    imagesHash: number;
    map: Record<string, Geomorph.MapDef>;
    layout: Record<Geomorph.GeomorphKey, Geomorph.LayoutGeneric<T, P, R, C>>;
    sheet: SpriteSheet;
  }

  type Geomorphs = GeomorphsGeneric<Geom.Poly, Geom.Vect, Geom.Rect, Connector>;
  type GeomorphsJson = GeomorphsGeneric<
    Geom.GeoJsonPolygon,
    Geom.VectJson,
    Geom.RectJson,
    ConnectorJson
  >;

  interface GmDoorId {
    gmId: number;
    doorId: number;
  }

  interface GmRoomId {
    gmId: number;
    roomId: number;
  }

  interface SymbolGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect
  > {
    key: SymbolKey;
    isHull: boolean;
    /** SVG's width (from `viewBox`) in world coordinates */
    width: number;
    /** SVG's height (from `viewBox`) in world coordinates */
    height: number;
    /**
     * Bounds of original image in symbol SVG.
     * May be offset e.g. because doors are centred along edges.
     */
    pngRect: R;

    /**
     * Uncut hull walls: only present in hull symbols.
     * A hull symbol may have other walls, but they'll be in `walls`.
     */
    hullWalls: P[];
    decor: P[];
    doors: P[];
    obstacles: P[];
    /** Union of uncut non-optional walls including hull walls. */
    walls: P[];
    windows: P[];
    unsorted: P[];

    /** Symbols can have sub symbols, e.g. hull symbols use them to layout a geomorph. */
    symbols: {
      symbolKey: Geomorph.SymbolKey;
      /** Original width (Starship Symbols coordinates i.e. 60 ~ 1 grid) */
      width: number;
      /** Original height (Starship Symbols coordinates i.e. 60 ~ 1 grid) */
      height: number;
      /** Normalized affine transform */
      transform: Geom.SixTuple;
      meta: Geom.Meta;
    }[];

    /** Doors tagged with `optional` can be removed */
    removableDoors: {
      /** The door `doors[doorId]` we can remove */
      doorId: number;
      /** The wall we need to add back in */
      wall: P;
    }[];

    /** Walls tagged with `optional` can be added */
    addableWalls: P[];
  }

  type Symbol = SymbolGeneric<Geom.Poly, Geom.Vect, Geom.Rect>;
  type SymbolJson = SymbolGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;

  type PreSymbol = Pretty<Pick<
    Geomorph.Symbol,
    "key" | "doors" | "isHull" | "walls" | "hullWalls" | "windows" | "width" | "height"
  >>;

  type PostSymbol = Pretty<Pick<
    Geomorph.Symbol, "hullWalls" | "walls" | "removableDoors" | "addableWalls"
  >>;

  /**
   * Much like `SymbolGeneric` where `symbols` has been absorbed into the other fields.
   */
  type FlatSymbolGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect
  > = Pretty<
    Omit<SymbolGeneric<P, V, R>, 'symbols' | 'pngRect' | 'width' | 'height' | 'hullWalls'>
  >;

  type FlatSymbol = FlatSymbolGeneric<Geom.Poly, Geom.Vect, Geom.Rect>;
  type FlatSymbolJson = FlatSymbolGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;

  interface MapDef {
    /** e.g. `demo-map-1` */
    key: string;
    gms: { gmKey: GeomorphKey; transform: Geom.SixTuple; }[];
  }

  interface LayoutGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect,
    C extends Geomorph.Connector | Geomorph.ConnectorJson
  > {
    key: GeomorphKey;
    pngRect: R;

    decor: Decor[];
    doors: C[];
    hullDoors: C[];
    hullPoly: P[];
    obstacles: LayoutObstacleGeneric<P>[];
    rooms: P[];
    walls: P[];
    windows: C[];
    unsorted: P[];

    navDecomp: Geom.TriangulationGeneric<V>;
    /** Index of triangle in `navDecomp.tris` where doorway triangles will begin */
    navDoorwaysOffset: number;
    /** AABBs of `navPolyWithDoors` i.e. original nav-poly */
    navRects: R[];
  }

  type Layout = LayoutGeneric<Geom.Poly, Geom.Vect, Geom.Rect, Connector>;
  type LayoutJson = LayoutGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson, ConnectorJson>;

  /**
   * Created in the browser, based on @see {Layout}
   */
  interface LayoutInstance extends Layout {
    gmId: number;
    transform: Geom.SixTuple;
    matrix: Geom.Mat;
    gridRect: Geom.Rect;
    inverseMatrix: Geom.Mat;
    mat4: import("three").Matrix4;

    isHullDoor(doorId: number): boolean;
  }

  /**
   * - Given `origPoly` and `symbolKey` we can extract the respective part of the symbol's PNG.
   * - Applying `transform` to `origPoly` yields the polygon in Geomorph space.
   */
  interface LayoutObstacleGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
  > {
    /** The `symbol` the obstacle originally comes from */
    symbolKey: SymbolKey;
    /** The index in `symbol.obstacles` this obstacle corresponds to */
    obstacleId: number;
    /** The height of this particular instance */
    height: number;
    /** `symbol.obstacles[symObsId]` -- could be inferred from `assets` */
    origPoly: P;
    /** Transform from original symbol coords into Geomorph coords */
    transform: Geom.SixTuple;
  }

  type LayoutObstacle = LayoutObstacleGeneric<Geom.Poly>;

  /**
   * Data determined by `w.gms`.
   * It can change on dynamic navMesh change.
   */
  interface GmsDataRoot {
    /** Total number of doors, each being a single quad (🔔 may change):  */
    doorCount: number;
    /** Total number of obstacles, each being a single quad:  */
    obstaclesCount: number;
    /** Total number of walls, where each wall is a single quad:  */
    wallCount: number;
    /** Per gmId, total number of wall line segments:  */
    wallPolySegCounts: number[];
  }
  
  /**
   * Data determined by a `Geomorph.GeomorphKey`.
   * We do not store in `w.gms` to avoid duplication.
   */
  interface GmData {
    gmKey: Geomorph.GeomorphKey;
    doorSegs: [Geom.Vect, Geom.Vect][];
    hitCtxt: CanvasRenderingContext2D;
    /** Debug only */
    navPoly?: THREE.BufferGeometry;
    /** These wall polygons are inset, so stroke does not jut out */
    nonHullCeilTops: Geom.Poly[];
    /** These door polygons are inset, so stroke does not jut out */
    doorCeilTops: Geom.Poly[];
    polyDecals: Geom.Poly[];
    roomGraph: import('../graph/room-graph').RoomGraphClass;
    /** Has this geomorph never occurred in any map so far? */
    unseen: boolean;
    wallSegs: { seg: [Geom.Vect, Geom.Vect]; meta: Geom.Meta; }[];
    /** Number of wall polygons in geomorph, where each wall can have many line segments */
    wallPolyCount: number;
    /** Per wall, number of line segments */
    wallPolySegCounts: number[];
  }

  //#region decor

  /** Serializable */
  type Decor = (
    | DecorCircle
    | DecorCuboid
    | DecorPoint
    | DecorRect
  );

  interface DecorCircle extends BaseDecor, Geom.Circle {
    type: 'circle';
  }

  /**
   * Vertices `center.xyz ± extent.xyz` rotated about `center` by `angle`.
   */
  interface DecorCuboid extends BaseDecor {
    type: 'cuboid';
    center: import('three').Vector3Like;
    extent: import('three').Vector3Like;
    /** Radians */
    angle: number;
  }

  interface DecorPoint extends BaseDecor, Geom.VectJson {
    type: 'point';
  }
  
  interface DecorRect extends BaseDecor, Geom.RectJson {
    type: 'rect';
    /** Radians */
    angle?: number;
  }

  interface BaseDecor {
    key: string;
    meta: Geom.Meta<Geomorph.GmRoomId>;
    /** 2D bounds inside XZ plane */
    bounds2d: Geom.RectJson;
    /** Epoch ms when last updated (overwritten) */
    updatedAt?: number;
    /** For defining decor via CLI (more succinct) */
    tags?: string[];
  }

  type DecorSheetRectCtxt = Geom.Meta<{ decorKey: Geomorph.DecorKey }>;

  type DecorKey = import('../service/geomorph.js').DecorKey;

  /** 🚧 clarify */
  type DecorCollidable = NPC.DecorCircle | NPC.DecorRect;

  type DecorGrid = Record<number, Record<number, {
    points: Set<Geomorph.DecorPoint>;
    colliders: Set<Geomorph.DecorCollidable>; // 🚧
  }>>;

  interface RoomDecor {
    /** Decor which came from room's parent geomorph symbol */
    symbol: NPC.DecorDef[];
    /** Everything in room */
    decor: Record<string, NPC.DecorDef>;
    /** All colliders in room */
    colliders: NPC.DecorCollidable[];
    /** All points in room */
    points: NPC.DecorPoint[];
  }

  //#endregion

  type GeomorphKey =
    | "g-101--multipurpose"
    | "g-102--research-deck"
    | "g-103--cargo-bay"
    | "g-301--bridge"
    | "g-302--xboat-repair-bay"
    | "g-303--passenger-deck";

  type GeomorphNumber = 101 | 102 | 103 | 301 | 302 | 303;

  /**
   * 🔔 Depends on geomorph service,
   * but in this way we avoid duplication.
   */
  type SymbolKey = import('../service/geomorph').SymbolKey;

  /**
   * All sprite-sheet metadata.
   */
  interface SpriteSheet {
    /**
     * - key format `{symbolKey} ${obstacleId}`
     * - `rect` in Starship Geomorphs Units (sgu), possibly scaled-up for higher-res images
     */
    obstacle: Record<`${Geomorph.SymbolKey} ${number}`, Geom.RectJson & ObstacleSheetRectCtxt>;
    obstacleDim: { width: number; height: number; }
    decorDim: { width: number; height: number; }
    decor: Record<Geomorph.DecorKey, Geom.RectJson & DecorSheetRectCtxt>;
  }

  interface ObstacleSheetRectCtxt {
    symbolKey: Geomorph.SymbolKey;
    obstacleId: number;
    /** e.g. `chair` */
    type: string;
  }


}
