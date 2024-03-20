declare namespace Geomorph {
  interface AssetsGeneric<
    T extends Geom.GeoJsonPolygon | Geom.Poly,
    P extends Geom.VectJson | Geom.Vect
  > {
    symbols: Record<Geomorph.SymbolKey, Geomorph.ParsedSymbol<T, P>>;
    maps: Record<string, Geomorph.MapDef>;
    /**
     * `metaKey` can be:
     * - any `Geomorph.SymbolKey` e.g. `301--hull` or `office--001--2x2`
     * - any mapKey e.g. `demo-map-1`
     * - any `Geomorph.GeomorphKey` e.g. `g-301--bridge`
     * - `global`
     */
    meta: {
      [metaKey: string]: {
        /** Defined for mapKeys and symbolKeys */
        contentHash?: number;
        /** Defined for symbolKeys */
        outputHash?: number;
        /** Defined for `global` i.e. hash of browser layout function */
        browserHash?: number;
        /** Epoch ms */
        lastModified: number;
      };
    };
  }

  type AssetsJson = AssetsGeneric<Geom.GeoJsonPolygon, Geom.VectJson>;
  type Assets = AssetsGeneric<Geom.Poly, Geom.Vect>;

  interface ConnectorRectGeneric<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.Vect | Geom.VectJson,
    R extends Geom.Rect | Geom.RectJson
  > extends WithMeta {
    poly: P;
    /** `poly.center` */
    center: V;
    /** `poly.rect` i.e. rotated rectangle */
    rect: R;
    /** Segment through middle of door */
    seg: [V, V];
    /** Points towards `entries[0]`. */
    normal: V;
    /** Radians 🚧 clarify */
    angle: number;
    /**
     * `[id of room infront, id of room behind]`
     * where a room is *infront* if `normal` is pointing towards it.
     * Hull doors have exactly one non-null entry.
     */
    roomIds: [null | number, null | number];
    /**
     * Aligned to `roomIds` i.e. `[infront, behind]`
     * where a room is *infront* if `normal` is pointing towards it.
     */
    entries: [V, V];
    /**
     * 🚧 migrate to recast/detour?
     * This door is connected to navmesh navZone.groups[navGroupId].
     */
    navGroupId: number;
  }

  type ConnectorRect = ConnectorRectGeneric<Geom.Poly, Geom.Vect, Geom.Rect>;
  type ConnectorRectJson = ConnectorRectGeneric<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;

  interface ParsedSymbol<
    P extends Geom.GeoJsonPolygon | Geom.Poly,
    V extends Geom.VectJson | Geom.Vect = Geom.VectJson,
    R extends Geom.RectJson | Geom.Rect = Geom.RectJson
  > {
    key: SymbolKey;
    isHull: boolean;
    /** Original SVG's width, inferred from `viewBox` */
    width: number;
    /** Original SVG's height, inferred from `viewBox` */
    height: number;
    /**
     * Bounds of original image in symbol SVG.
     * May be offset e.g. because doors are centred along edges.
     */
    pngRect: Geom.RectJson;

    /** Hull walls, only non-empty in hull */
    hullWalls: WithMeta<P>[];
    walls: WithMeta<P>[];
    obstacles: WithMeta<P>[];
    doors: ConnectorRectGeneric<P, V, R>[];
    windows: ConnectorRectGeneric<P, V, R>[];
    /** 🚧 split further? */
    unsorted: WithMeta<P>[];

    /** Hull symbols have sub symbols, defining the layout of the geomorph. */
    symbols: WithMeta<{
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
    addableWalls: WithMeta<P>[];
  }

  type PreParsedSymbol<T extends Geom.GeoJsonPolygon | Geom.Poly> = Pretty<
    Pick<
      Geomorph.ParsedSymbol<T, Geom.Vect>,
      "key" | "doors" | "isHull" | "walls" | "hullWalls" | "windows" | "width" | "height"
    >
  >;

  type PostParsedSymbol<T extends Geom.GeoJsonPolygon | Geom.Poly> = Pretty<
    Pick<
      Geomorph.ParsedSymbol<T, Geom.Vect>,
      "hullWalls" | "walls" | "removableDoors" | "addableWalls"
    >
  >;

  /** Previously called `PointMeta` */
  type Meta<T extends {} = {}> = Record<string, any> & T;

  type WithMeta<T extends {} = {}, U extends {} = {}> = T & { meta: Meta<U> };

  interface MapDef {
    gms: {
      gmKey: GeomorphKey;
      /** Default `[1, 0, 0, 1, 0, 0]` */
      transform?: [number, number, number, number, number, number];
    }[];
  }

  interface LayoutInstance extends Layout {
    gmId: number;
    transform: Geom.SixTuple;
    mat4: import("three").Matrix4;
  }

  /** Layout of a single geomorph */
  interface Layout {
    key: GeomorphKey;
    pngRect: Geom.Rect;
    /** Epoch ms */
    lastModified: number;
    // 🚧
    wallSegs: [Geom.Vect, Geom.Vect][];
    doorSegs: [Geom.Vect, Geom.Vect][];
  }

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
    | "bridge--042--8x9"
    // | "cargo--002--2x2"
    // | "cargo--003--2x4"
    // | "cargo--010--2x4"
    // | "console--018--1x1"
    // | "console--022--1x2"
    // | "console--031--1x1"
    // | "couch-and-chairs--006--0.4x2"
    // | "empty-room--006--2x2"
    | "empty-room--013--2x3"
    // | "empty-room--019--2x4"
    // | "empty-room--020--2x4"
    // | "empty-room--039--3x4"
    // | "empty-room--060--4x4"
    // | "empty-room--074--8x4"
    // | "empty-room--076--3x5"
    // | "engineering--045--6x4"
    // | "engineering--047--4x7"
    // | "fresher--002--0.4x0.6"
    // | "fresher--020--2x2"
    // | "fresher--025--3x2"
    // | "fresher--036--4x2"
    // | "fuel--010--4x2"
    // | "gaming-tables--001--2x1"
    // | "galley-and-mess-halls--006--4x2"
    // | "galley-and-mess-halls--025--2x3"
    // | "iris-valves--005--1x1"
    // | "lifeboat--small-craft--2x4"
    // | "lab--012--4x3"
    // | "lab--018--4x4"
    // | "lab--023--4x4"
    // | "lab--030--3x1"
    // | "lounge--009--3x2"
    // | "lounge--015--4x2"
    // | "lounge--017--4x2"
    // | "low-berth--003--1x1"
    // | "machinery--001--0.4x1"
    // | "machinery--020--1x1.6"
    // | "machinery--065--1.8x1.8"
    // | "machinery--091--1.6x1.8"
    // | "machinery--155--1.8x3.6"
    // | "machinery--156--2x4"
    // | "machinery--158--1.8x3.6"
    // | "machinery--357--4x2"
    // | "machinery--077--1.6x1.8"
    // | "medical--007--3x2"
    // | "medical--008--3x2"
    // | "medical-bed--006--1.6x3.6"
    // | "misc-stellar-cartography--020--10x10"
    | "misc-stellar-cartography--023--4x4"
    | "office--001--2x2"
    // | "office--004--2x2"
    // | "office--006--2x2"
    | "office--020--2x3"
    | "office--023--2x3"
    // | "office--025--2x3"
    | "office--026--2x3"
    // | "office--055--2x4"
    // | "office--061--3x4"
    // | "office--074--4x4"
    // | "office--089--4x4"
    // | "sensors--003--1.4x1"
    // | "ships-locker--003--1x1"
    // | "ships-locker--007--2x1"
    // | "ships-locker--020--2x2"
    // | "ships-locker--011--2x1"
    // | "shop--027--1.6x0.4"
    // | "shop--028--1.6x0.8"
    // | "stateroom--012--2x2"
    | "stateroom--014--2x2"
    // | "stateroom--018--2x3"
    // | "stateroom--019--2x3"
    | "stateroom--020--2x3"
    // | "stateroom--035--2x3"
    | "stateroom--036--2x4";
  // | "stateroom--100--3x4"
  // | "table--009--0.8x0.8"
  // | "weaponry--013--1x2"
  // | "window--001--1x0.2"
  // | "window--007--3x0.2"
}
