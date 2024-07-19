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
    /** Points into @see Geomorph.Layout.navRects */
    navRectId: number;
    /**
     * `[id of room infront, id of room behind]`
     * where a room is *infront* if `normal` is pointing towards it.
     * Hull doors have exactly one non-null entry.
     */
    roomIds: [null | number, null | number];
  }

  type HullDoorMeta = Geom.Meta<{ edge: Geom.DirectionString }>;

  interface DoorState extends Geomorph.GmDoorId {
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
    /** `g{gmId}d${doorId}` */
    key: `g${number}d${number}`;
    gmId: number;
    doorId: number;
    /** Non-isolated hull doors have an associated door */
    other?: { gmId: number; doorId: number };
  }

  interface GmRoomId {
    gmId: number;
    roomId: number;
    /** `gmRoomKey` */
    grKey: Geomorph.GmRoomKey;
  }

  /** `g${gmId}r${roomId}` */
  type GmRoomKey = `g${number}r${number}`;

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
    num: GeomorphNumber;
    pngRect: R;

    decor: Decor[];
    doors: C[];
    hullDoors: C[];
    hullPoly: P[];
    labels: DecorPoint[];
    obstacles: LayoutObstacleGeneric<P, V>[];
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

    getOtherRoomId(doorId: number, roomId: number): number;
    isHullDoor(doorId: number): boolean;
  }

  /**
   * - Given `origPoly` and `symbolKey` we can extract the respective part of the symbol's PNG.
   * - Applying `transform` to `origPoly` yields the polygon in Geomorph space.
   */
  interface LayoutObstacleGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.VectJson | Geom.Vect,
  > {
    /** The `symbol` the obstacle originally comes from */
    symbolKey: SymbolKey;
    /** The index in `symbol.obstacles` this obstacle corresponds to */
    obstacleId: number;
    /** The height of this particular instance */
    height: number;
    /** `symbol.obstacles[obstacleId]` -- could be inferred from `assets` */
    origPoly: P;
    /** Transform from original symbol into Geomorph (meters) */
    transform: Geom.SixTuple;
    /** `origPoly.center` transformed by `transform` */
    center: V;
    /** Shortcut to `origPoly.meta` */
    meta: Geom.Meta;
  }

  type LayoutObstacle = LayoutObstacleGeneric<Geom.Poly, Geom.Vect>;
  type LayoutObstacleJson = LayoutObstacleGeneric<Geom.GeoJsonPolygon, Geom.VectJson>;

  //#region decor

  /** Serializable */
  type Decor = (
    | DecorCircle
    | DecorCuboid
    | DecorPoint
    | DecorQuad
    | DecorPoly
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
    /** Half-extents */
    extent: import('three').Vector3Like;
    /** Radians */
    angle: number;
  }

  interface DecorPoint extends BaseDecor, Geom.VectJson {
    type: 'point';
    /** Orientation in degrees, like `meta.orient` */
    orient: number;
  }
  
  /** Simple polygon sans holes. */
  interface DecorQuad extends BaseDecor {
    type: 'quad';
    transform: Geom.SixTuple;
    center: Geom.VectJson;
  }

  interface DecorPoly extends BaseDecor {
    type: 'poly';
    points: Geom.VectJson[];
    /** Center of `new Poly(points)` */
    center: Geom.VectJson;
  }

  interface BaseDecor {
    /** Either auto-assigned e.g. decor from geomorphs, or specified by user. */
    key: string;
    meta: Geom.Meta<Geomorph.GmRoomId>;
    /** 2D bounds inside XZ plane */
    bounds2d: Geom.RectJson;
    /** Epoch ms when last updated (overwritten) */
    updatedAt?: number;
    /**
     * Indicates decor that comes from a geomorph layout,
     * i.e. decor that is initially instantiated.
     */
    src?: Geomorph.GeomorphKey;
    // /** For defining decor via CLI (more succinct) */
    // tags?: string[];
  }

  type DecorSheetRectCtxt = Geom.Meta<{ decorImgKey: Geomorph.DecorImgKey }>;

  type DecorImgKey = import('../service/geomorph.js').DecorImgKey;

  /** 🚧 clarify */
  type DecorCollidable = Geomorph.DecorCircle | Geomorph.DecorPoly;

  /** `byGrid[x][y]` */
  type DecorGrid = Set<Geomorph.Decor>[][];

  /** Previously we sorted its groups e.g. "points" */
  type RoomDecor = Set<Geomorph.Decor>;

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
    decor: Record<Geomorph.DecorImgKey, Geom.RectJson & DecorSheetRectCtxt>;
  }

  interface ObstacleSheetRectCtxt {
    symbolKey: Geomorph.SymbolKey;
    obstacleId: number;
    /** e.g. `chair` */
    type: string;
  }

  type GmsData = import('../service/create-gms-data').GmsData;

}
