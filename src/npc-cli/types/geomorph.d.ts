declare namespace Geomorph {
  interface AssetsGeneric<
    T extends Geom.GeoJsonPolygon | Geom.Poly,
    P extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect
  > {
    symbols: Record<Geomorph.SymbolKey, Geomorph.SymbolGeneric<T, P, R>>;
    maps: Record<string, Geomorph.MapDef>;
    sheet: SpriteSheet;
    /**
     * `metaKey` is either
     * - a `Geomorph.SymbolKey`
     * - a mapKey e.g. `demo-map-1`
     */
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

  type GeomorphsHash = PerGeomorphHash & {
    /** `${maps} ${layouts} ${sheets}` */
    full: `${number} ${number} ${number}`;

    /** Hash of all maps */
    maps: number;
    /** Hash of all layouts */
    layouts: number;
    /** Depends on rect lookup, images, and skins */
    sheets: number;
    /** `${layouts} ${maps}` */
    decor: `${number} ${number}`;
    /** Hash of current map */
    map: number;

    /**
     * 🔔 `mapGmHashes[gmId]` is hash of `map.gms[gmId]`
     * i.e. hashes { gmKey, transform } 
     */
    mapGmHashes: number[];
  }

  type PerGeomorphHash = Record<Geomorph.GeomorphKey, {
    full: number;
    decor: number;
    nav: number;
  }>;

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

  type HullDoorMeta = Meta<{ edge: Geom.DirectionString }>;

  interface DoorState extends Geomorph.GmDoorId {
    /** gmDoorKey format i.e. `g{gmId}d{doorId}` */
    gdKey: `g${number}d${number}`;
    door: Geomorph.Connector;
    instanceId: number;

    /** Is the door automatic? */
    auto: boolean;
    /** Is this an axis-aligned rectangle? */
    axisAligned: boolean;
    /** Is the door open? */
    open: boolean;
    /** Is the door locked? */
    locked: boolean;

    /** Is the door sealed? */
    sealed: boolean;
    /** Is this a hull door? */
    hull: boolean;

    /** Between `0.1` (open) and `1` (closed) */
    ratio: number;
    /** Src of transformed door segment */
    src: Geom.VectJson;
    /** Dst of transformed door segment */
    dst: Geom.VectJson;
    /** Center of transformed door */
    center: Geom.Vect;
    /** Direction of transformed door segment */
    dir: Geom.VectJson;
    normal: Geom.VectJson;
    /** Length of `door.seg` */
    segLength: number;
    /** 1st entrance pointed to by `normal` */
    entrances: [Geom.Seg, Geom.Seg];
    /** As wide as door, slightly less deep than doorway. */
    collidePoly: Geom.Poly;
    /** Bounds of `doorway`. */
    collideRect: Geom.Rect;

    closeTimeoutId?: number;
  }

  interface ToggleDoorOpts extends BaseDoorToggle {
    /** Is the doorway clear? */
    clear?: boolean;
    /** Should we close the door? */
    close?: boolean;
    /** Should we open door? */
    open?: boolean;
  }
  
  interface ToggleLockOpts extends BaseDoorToggle {
    /** Should we lock the door? */
    lock?: boolean;
    /** Should we unlock the door? */
    unlock?: boolean;
  }

  interface BaseDoorToggle {
    /**
     * Does the instigator exist (boolean) and have access (true)?
     * See also `w.e.canAccess(npcKey, gdKey)`.
     */
    access?: boolean;
  }

  interface GeomorphsGeneric<
    T extends Geom.GeoJsonPolygon | Geom.Poly,
    P extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect,
    C extends Geomorph.Connector | Geomorph.ConnectorJson
  > {
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
    /** gmDoorKey `g{gmId}d${doorId}` */
    gdKey: GmDoorKey;
    gmId: number;
    doorId: number;
  }

  interface GmRoomId {
    /** gmRoomKey `g{gmId}r${roomId}` */
    grKey: Geomorph.GmRoomKey;
    gmId: number;
    roomId: number;
  }

  /** `g${gmId}r${roomId}` */
  type GmRoomKey = `g${number}r${number}`;

  /** `g${gmId}d${doorId}` */
  type GmDoorKey = `g${number}d${number}`;

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
      /** Normalized affine transform acting on rect `(0, 0, width, height)` */
      transform: Geom.SixTuple;
      meta: Meta;
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

  /**
   * `rooms` + `doors` + `walls` form a disjoint union covering the `hullPoly`.
   * 🚧 what about `windows`?
   */
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
    determinant: number;

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
    meta: Meta;
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
    transform: Geom.SixTuple;
  }

  interface DecorPoint extends BaseDecor, Geom.VectJson {
    type: 'point';
    /** Orientation in degrees, where the unit vector `(1, 0)` corresponds to `0`  */
    orient: number;
    meta: Meta<Geomorph.GmRoomId & { img?: DecorImgKey }>;
  }
  
  /** Simple polygon sans holes. */
  interface DecorQuad extends BaseDecor {
    type: 'quad';
    transform: Geom.SixTuple;
    center: Geom.VectJson;
    /** Determinant of 2x2 part of `transform` */
    det: number;
    meta: Meta<Geomorph.GmRoomId & { img: DecorImgKey }>;
  }

  interface DecorRect extends BaseDecor {
    type: 'rect';
    points: Geom.VectJson[];
    /** Center of `new Poly(points)` */
    center: Geom.VectJson;
    /** Radians; makes an `Geom.AngledRect` together with `bounds2d`  */
    angle: number;
  }

  interface BaseDecor {
    /** Either auto-assigned e.g. decor from geomorphs, or specified by user. */
    key: string;
    meta: Meta<Geomorph.GmRoomId>;
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

  type DecorSheetRectCtxt = Meta<{
    decorImgKey: Geomorph.DecorImgKey;
    /** 0-based index of sheet */
    sheetId: number;
  }>;

  type DecorImgKey = import('../service/const.js').DecorImgKey;

  /** 🚧 clarify */
  type DecorCollidable = Geomorph.DecorCircle | Geomorph.DecorRect;

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
   * 🔔 Depends on service/const, but avoids duplication.
   */
  type SymbolKey = import('../service/const').SymbolKey;

  /**
   * All sprite-sheet metadata.
   */
  interface SpriteSheet {
    /** Over all sheets */
    decor: Record<Geomorph.DecorImgKey, Geom.RectJson & DecorSheetRectCtxt>;
    /** Aligned to sheets; its length is the number of the sheets. */
    decorDims: { width: number; height: number; }[];
    /** Maximum over all sheets, for texture array */
    maxDecorDim: { width: number; height: number; }

    /**
     * Over all sheets
     * - key format `{symbolKey} ${obstacleId}`
     * - `rect` in Starship Geomorphs Units (sgu), possibly scaled-up for higher-res images
     */
    obstacle: Record<Geomorph.ObstacleKey, Geom.RectJson & ObstacleSheetRectCtxt>;
    /** Aligned to sheets; its length is the number of the sheets. */
    obstacleDims: { width: number; height: number; }[];
    /** Maximum over all sheets, for texture array */
    maxObstacleDim: { width: number; height: number; }

    imagesHash: number;
    skins: {
      /** e.g. `npcClassKey` is a `uvMapKey` */
      svgHash: { [uvMapKey: string]: number; };
      /** e.g. `npcClassKey` is a `uvMapKey` */
      uvMap: { [uvMapKey: string]: UvRectLookup; };
      /** e.g. `npcClassKey` is a `uvMapKey` */
      uvMapDim: { [uvMapKey: string]: { width: number; height: number; }; };
    };
  }

  type ObstacleKey = `${Geomorph.SymbolKey} ${number}`;

  interface ObstacleSheetRectCtxt {
    symbolKey: Geomorph.SymbolKey;
    obstacleId: number;
    /** e.g. `chair` */
    type: string;
    sheetId: number;
  }

  interface UvRectLookup {
    [uvRectName: string]: Geom.RectJson
  }

  type GmsData = import('../service/create-gms-data').GmsData;

}
