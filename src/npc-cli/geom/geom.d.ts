declare namespace Geom {

  export type Vect = import('.').Vect;
  export type Rect = import('.').Rect;
  export type Poly = import('.').Poly;
  export type Ray = import('.').Ray;
  export type Mat = import('.').Mat;
  export type SpacialHash<T> = import('.').SpacialHash<T>;
  
  export type Coord = [number, number];
  export type Seg = { src: VectJson; dst: VectJson };
  export type Circle = { radius: number; center: VectJson; };

  export interface GeoJsonPolygon {
    /** Identifier amongst GeoJSON formats. */
    type: 'Polygon';
    /**
     * The 1st array defines the _outer polygon_,
     * the others define non-nested _holes_.
     */
    coordinates: Coord[][];
    meta?: Record<string, string>;
  }

  export interface VectJson {
    x: number;
    y: number;
  }

  export interface RectJson {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface Triangulation {
    vs: Vect[]; 
    tris: [number, number, number][];
  }

  export interface TriangulationJson {
    vs: VectJson[]; 
    tris: [number, number, number][];
  }

  /** Rotated around `(baseRect.x, baseRect.y) */
  export interface AngledRect<T> {
    /** The unrotated rectangle */
    baseRect: T;
    /** Radians */
    angle: number;
  }

  /** 'n' | 'e' | 's' | 'w' */
  export type Direction = 0 | 1 | 2 | 3;

  export interface ClosestOnOutlineResult {
    point: Geom.VectJson;
    norm: Geom.VectJson;
    dist: number;
    edgeId: number;
  }

  export type SixTuple = [number, number, number, number, number, number];

  export interface PixiTransform {
    /** Identity is `{ x: 1, y: 1 }` */
    scale: Geom.VectJson;
    /** degrees */
    angle: number;
    x: number;
    y: number;
  }
}
