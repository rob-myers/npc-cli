import { wallHeight } from "./const";
import { mapValues } from "./generic";
import { geom } from "./geom";
import { geomorphService } from "./geomorph";
import { RoomGraphClass } from "../graph/room-graph";

// 🚧 fix HMR on edit e.g. recompute and redraw
export default function createGmsData() {
  const gmsData = {
    ...mapValues(geomorphService.toGmNum, (_, gmKey) => ({ ...emptyGmData, gmKey })),
  
    /** Total number of doors, each being a single quad (🔔 may change):  */
    doorCount: 0,
    /** Total number of obstacles, each being a single quad:  */
    obstaclesCount: 0,
    /** Total number of walls, where each wall is a single quad:  */
    wallCount: 0,
    /** Per gmId, total number of wall line segments:  */
    wallPolySegCounts: /** @type {number[]} */ ([]),

    /** @param {Geomorph.Layout} gm */
    computeGmData(gm) {// recomputed onchange geomorphs.json (dev only)
      const gmData = gmsData[gm.key];

      gmData.doorSegs = gm.doors.map(({ seg }) => seg);
      gmData.polyDecals = gm.unsorted.filter(x => x.meta.poly === true);
      gmData.wallSegs = gm.walls.flatMap((x) => x.lineSegs.map(seg => ({ seg, meta: x.meta })));
      gmData.wallPolyCount = gm.walls.length;
      gmData.wallPolySegCounts = gm.walls.map(({ outline, holes }) =>
        outline.length + holes.reduce((sum, hole) => sum + hole.length, 0)
      );
      const nonHullWallsTouchCeil = gm.walls.filter(x => !x.meta.hull &&
        (x.meta.h === undefined || (x.meta.y + x.meta.h === wallHeight)) // touches ceiling
      );
      // inset so stroke does not jut out
      gmData.nonHullCeilTops = nonHullWallsTouchCeil.flatMap(x => geom.createInset(x, 0.04));
      gmData.doorCeilTops = gm.doors.flatMap(x => geom.createInset(x.poly, 0.04));

      gmData.hitCtxt ??= /** @type {CanvasRenderingContext2D} */ (
        document.createElement('canvas').getContext('2d')
      );
      gmData.hitCtxt.canvas.width = gm.pngRect.width;
      gmData.hitCtxt.canvas.height = gm.pngRect.height;
      
      // 🚧 compute connector.roomIds first
      // gmData.roomGraph = RoomGraphClass.from(RoomGraphClass.json(gm.rooms, gm.doors, gm.windows));

      gmData.unseen = false;
    },

    /**
     * Recomputed when `w.gms` changes e.g. map changes
     * @param {Geomorph.LayoutInstance[]} gms
     */
    computeGmsData(gms) {
      gmsData.doorCount = gms.reduce((sum, { key }) => sum + gmsData[key].doorSegs.length, 0);
      gmsData.wallCount = gms.reduce((sum, { key }) => sum + gmsData[key].wallSegs.length, 0);
      gmsData.obstaclesCount = gms.reduce((sum, { obstacles }) => sum + obstacles.length, 0);

      gmsData.wallPolySegCounts = gms.map(({ key: gmKey }) =>
        gmsData[gmKey].wallPolySegCounts.reduce((sum, count) => sum + count, 0),
      );
    },
  };
  return gmsData;
};

/** @type {GmData} */
const emptyGmData = {
  gmKey: 'g-101--multipurpose', // overridden
  doorSegs: [], doorCeilTops: [],
  hitCtxt: /** @type {*} */ (null),
  navPoly: undefined,
  nonHullCeilTops: [],
  polyDecals: [],
  roomGraph: new RoomGraphClass(),
  unseen: true,
  wallPolyCount: 0,
  wallPolySegCounts: [],
  wallSegs: [],
};

/**
 * @typedef {ReturnType<typeof createGmsData>} GmsData
 * 1. Data determined by `w.gms` (can change in dev, or dynamic navMesh).
 * 2. Data determined by a `Geomorph.GeomorphKey`, keyed by latter.
 */

/**
 * Data determined by a `Geomorph.GeomorphKey`.
 * We do not store in `w.gms` to avoid duplication.
 * @typedef GmData
 * @property {Geomorph.GeomorphKey} gmKey
 * @property {[Geom.Vect, Geom.Vect][]} doorSegs
 * @property {CanvasRenderingContext2D} hitCtxt
 * @property {import('three').BufferGeometry} [navPoly] Debug only
 * @property {Geom.Poly[]} nonHullCeilTops These wall polygons are inset, so stroke does not jut out
 * @property {Geom.Poly[]} doorCeilTops These door polygons are inset, so stroke does not jut out
 * @property {Geom.Poly[]} polyDecals
 * @property {import('../graph/room-graph').RoomGraphClass} roomGraph
 * @property {boolean} unseen Has this geomorph never occurred in any map so far?
 * @property {{ seg: [Geom.Vect, Geom.Vect]; meta: Geom.Meta; }[]} wallSegs
 * @property {number} wallPolyCount Number of wall polygons in geomorph, where each wall can have many line segments
 * @property {number[]} wallPolySegCounts Per wall, number of line segments
 */
