declare namespace Geomorph {
  interface AssetsGeneric<
    T extends Geom.GeoJsonPolygon | Geom.Poly,
    P extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect
  > {
    symbols: Record<Geomorph.SymbolKey, Geomorph.ParsedSymbolGeneric<T, P, R>>;
    maps: Record<string, Geomorph.MapDef>;
    /** `metaKey` is a `Geomorph.SymbolKey` or a mapKey e.g. `demo-map-1` */
    meta: { [metaKey: string]: { outputHash: number } };
  }

  type AssetsJson = AssetsGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;
  type Assets = AssetsGeneric<Geom.Poly, Geom.Vect, Geom.Rect>;

  type Connector = import("../service/geomorph").Connector;

  interface ConnectorJson {
    poly: Geomorph.WithMeta<Geom.GeoJsonPolygon>;
    /**
     * `[id of room infront, id of room behind]`
     * where a room is *infront* if `normal` is pointing towards it.
     * Hull doors have exactly one non-null entry.
     */
    roomIds: [null | number, null | number];
  }

  interface DoorMeta extends Geomorph.GmDoorId {
    door: Geomorph.Connector;
    instanceId: number;
    /** `${door.seg.x},${door.seg.y}` */
    srcSegKey: `${number},${number}`;
    /** Is the door open? */
    open: boolean;
    /** Between `0.1` (open) and `1` (closed) */
    ratio: number;
    /** Source of transformed door segment */
    src: Geom.VectJson;
    /** Direction of transformed door segment */
    dir: Geom.VectJson;
    /** Length of `door.seg` */
    segLength: number;
  }

  interface GeomorphsGeneric<
    T extends Geom.GeoJsonPolygon | Geom.Poly,
    P extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect,
    C extends Geomorph.Connector | Geomorph.ConnectorJson
  > {
    mapsHash: number;
    layoutsHash: number;
    map: Record<string, Geomorph.MapDef>;
    layout: Record<Geomorph.GeomorphKey, Geomorph.LayoutGeneric<T, P, R, C>>;
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

  interface ParsedSymbolGeneric<
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
    hullWalls: Geomorph.WithMeta<P>[];
    decor: Geomorph.WithMeta<P>[];
    doors: Geomorph.WithMeta<P>[];
    obstacles: Geomorph.WithMeta<P>[];
    /** Union of uncut non-optional walls including hull walls. */
    walls: Geomorph.WithMeta<P>[];
    windows: Geomorph.WithMeta<P>[];
    /** 🚧 refine? */
    unsorted: Geomorph.WithMeta<P>[];

    /** Symbols can have sub symbols, e.g. hull symbols use them to layout a geomorph. */
    symbols: Geomorph.WithMeta<{
      symbolKey: Geomorph.SymbolKey;
      /** Original width (Starship Symbols coordinates i.e. 60 ~ 1 grid) */
      width: number;
      /** Original height (Starship Symbols coordinates i.e. 60 ~ 1 grid) */
      height: number;
      /** Normalized affine transform */
      transform: Geom.SixTuple;
    }>[];

    /** Doors tagged with `optional` can be removed */
    removableDoors: {
      /** The door `doors[doorId]` we can remove */
      doorId: number;
      /** The wall we need to add back in */
      wall: P;
    }[];

    /** Walls tagged with `optional` can be added */
    addableWalls: Geomorph.WithMeta<P>[];
  }

  type ParsedSymbol = ParsedSymbolGeneric<Geom.Poly, Geom.Vect, Geom.Rect>;
  type ParsedSymbolJson = ParsedSymbolGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;

  type PreParsedSymbol = Pretty<
    Pick<
      Geomorph.ParsedSymbol,
      "key" | "doors" | "isHull" | "walls" | "hullWalls" | "windows" | "width" | "height"
    >
  >;

  type PostParsedSymbol = Pretty<
    Pick<Geomorph.ParsedSymbol, "hullWalls" | "walls" | "removableDoors" | "addableWalls">
  >;

  /**
   * @see ParsedSymbolGeneric` where `symbols` has been absorbed into the other fields.
   */
  type FlatSymbolGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect
  > = Pretty<
    Omit<ParsedSymbolGeneric<P, V, R>, 'symbols' | 'pngRect' | 'width' | 'height' | 'hullWalls'>
  >;

  type FlatSymbol = FlatSymbolGeneric<Geom.Poly, Geom.Vect, Geom.Rect>;
  type FlatSymbolJson = FlatSymbolGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;

  interface MapDef {
    /** e.g. `demo-map-1` */
    key: string;
    gms: {
      gmKey: GeomorphKey;
      transform: Geom.SixTuple;
    }[];
  }

  interface LayoutGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.VectJson | Geom.Vect,
    R extends Geom.RectJson | Geom.Rect,
    C extends Geomorph.Connector | Geomorph.ConnectorJson
  > {
    key: GeomorphKey;
    pngRect: R;

    /** 🚧 points, rects or circles */
    decor: WithMeta<P>[];
    hullPoly: P[];
    rooms: WithMeta<P>[];
    hullDoors: C[];
    doors: C[];
    windows: C[];
    walls: WithMeta<P>[];

    navDecomp: Geom.TriangulationGeneric<V>;
    /** Index of triangle in `navDecomp.tris` where doorway triangles will begin */
    navDoorwaysOffset: number;
  }

  type Layout = LayoutGeneric<Geom.Poly, Geom.Vect, Geom.Rect, Connector>;
  type LayoutJson = LayoutGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson, ConnectorJson>;

  interface LayoutInstance extends Layout {
    gmId: number;
    transform: Geom.SixTuple;
    mat4: import("three").Matrix4;
    //
    wallSegs: [Geom.Vect, Geom.Vect][];
    doorSegs: [Geom.Vect, Geom.Vect][];
  }

  type Meta<T extends {} = {}> = Record<string, any> & T;

  type WithMeta<T extends {} = {}, U extends {} = {}> = T & { meta: Meta<U> };

  type GeomorphKey =
    | "g-101--multipurpose"
    | "g-102--research-deck"
    | "g-103--cargo-bay"
    | "g-301--bridge"
    | "g-302--xboat-repair-bay"
    | "g-303--passenger-deck";

  type GeomorphNumber = 101 | 102 | 103 | 301 | 302 | 303;

  type SymbolKey =
    | "101--hull"
    | "102--hull"
    | "103--hull"
    | "301--hull"
    | "302--hull"
    | "303--hull"
    | "bed--004--0.8x1.4"
    | "bed--005--0.6x1.2"
    | "bridge--042--8x9"
    // | "cargo--002--2x2"
    // | "cargo--003--2x4"
    // | "cargo--010--2x4"
    // | "console--018--1x1"
    | "console--022--1x2"
    // | "console--031--1x1"
    | "console--051--0.4x0.6"
    // | "couch-and-chairs--006--0.4x2"
    // | "empty-room--006--2x2"
    | "empty-room--013--2x3"
    // | "empty-room--019--2x4"
    // | "empty-room--020--2x4"
    | "empty-room--039--3x4"
    // | "empty-room--060--4x4"
    // | "empty-room--074--8x4"
    // | "empty-room--076--3x5"
    | "engineering--045--6x4"
    | "engineering--047--4x7"
    // | "fresher--002--0.4x0.6"
    | "fresher--020--2x2"
    | "fresher--025--3x2"
    | "fresher--036--4x2"
    | "fuel--010--4x2"
    // | "gaming-tables--001--2x1"
    // | "galley-and-mess-halls--006--4x2"
    // | "galley-and-mess-halls--025--2x3"
    // | "iris-valves--005--1x1"
    | "lifeboat--small-craft--2x4"
    | "lab--012--4x3"
    | "lab--018--4x4"
    | "lab--023--4x4"
    // | "lab--030--3x1"
    // | "lounge--009--3x2"
    | "lounge--015--4x2"
    // | "lounge--017--4x2"
    // | "low-berth--003--1x1"
    // | "machinery--001--0.4x1"
    // | "machinery--020--1x1.6"
    // | "machinery--065--1.8x1.8"
    // | "machinery--091--1.6x1.8"
    | "machinery--155--1.8x3.6"
    | "machinery--156--2x4"
    | "machinery--158--1.8x3.6"
    | "machinery--357--4x2"
    // | "machinery--077--1.6x1.8"
    | "medical--007--3x2"
    | "medical--008--3x2"
    | "medical-bed--006--1.6x3.6"
    | "misc-stellar-cartography--020--10x10"
    | "misc-stellar-cartography--023--4x4"
    | "office--001--2x2"
    | "office--004--2x2"
    | "office--006--2x2"
    | "office--020--2x3"
    | "office--023--2x3"
    // | "office--025--2x3"
    | "office--026--2x3"
    // | "office--055--2x4"
    | "office--061--3x4"
    | "office--074--4x4"
    | "office--089--4x4"
    // | "sensors--003--1.4x1"
    // | "ships-locker--003--1x1"
    // | "ships-locker--007--2x1"
    // | "ships-locker--020--2x2"
    // | "ships-locker--011--2x1"
    // | "shop--027--1.6x0.4"
    // | "shop--028--1.6x0.8"
    | "stateroom--012--2x2"
    | "stateroom--014--2x2"
    | "stateroom--018--2x3"
    // | "stateroom--019--2x3"
    | "stateroom--020--2x3"
    | "stateroom--035--2x3"
    | "stateroom--036--2x4"
  // | "stateroom--100--3x4"
  // | "table--009--0.8x0.8"
  // | "weaponry--013--1x2"
  // | "window--001--1x0.2"
  // | "window--007--3x0.2"
    | "extra--fresher--001--0.5x0.5"
    | "extra--fresher--002--0.5x0.5"
}
