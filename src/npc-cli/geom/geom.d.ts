declare namespace Geom {
  type Vect = import(".").Vect;
  type Rect = import(".").Rect;
  type Poly = import(".").Poly;
  type Ray = import(".").Ray;
  type Mat = import(".").Mat;
  type SpacialHash<T> = import(".").SpacialHash<T>;

  type Coord = [number, number];
  type Seg = { src: VectJson; dst: VectJson };
  type Circle = { radius: number; center: VectJson };

  interface GeoJsonPolygon {
    /** Identifier amongst GeoJSON formats. */
    type: "Polygon";
    /**
     * The 1st array defines the _outer polygon_,
     * the others define non-nested _holes_.
     */
    coordinates: Coord[][];
    meta?: Record<string, string>;
  }

  interface VectJson {
    x: number;
    y: number;
  }

  interface RectJson {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface Triangulation {
    vs: Vect[];
    tris: [number, number, number][];
  }

  interface TriangulationJson {
    vs: VectJson[];
    tris: [number, number, number][];
  }

  /** Rotated around `(baseRect.x, baseRect.y) */
  interface AngledRect<T> {
    /** The unrotated rectangle */
    baseRect: T;
    /** Radians */
    angle: number;
  }

  /** 'n' | 'e' | 's' | 'w' */
  type Direction = 0 | 1 | 2 | 3;

  interface ClosestOnOutlineResult {
    point: Geom.VectJson;
    norm: Geom.VectJson;
    dist: number;
    edgeId: number;
  }

  type SixTuple = [number, number, number, number, number, number];

  /** Previously called `PointMeta` */
  type Meta<T extends {} = {}> = Record<string, any> & T;

  type WithMeta<T extends {} = {}, U extends {} = {}> = T & { meta: Meta<U> };

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
}
