import { hitTestRed, wallHeight, worldToSguScale } from "./const";
import { mapValues } from "./generic";
import { geom, tmpVec1 } from "./geom";
import { geomorphService } from "./geomorph";
import { RoomGraphClass } from "../graph/room-graph";
import { drawPolygons } from "./dom";

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

    layout: /** @type {Record<Geomorph.GeomorphKey, Geomorph.Layout>} */ ({}),

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

      // canvas for quick "point -> roomId", "point -> doorId" computation
      gmData.hitCtxt ??= /** @type {CanvasRenderingContext2D} */ (
        document.createElement('canvas').getContext('2d')
      );
      const bounds = gm.pngRect.clone().scale(worldToSguScale);
      gmData.hitCtxt.canvas.width = bounds.width;
      gmData.hitCtxt.canvas.height = bounds.height;
      gmsData.drawHitCanvas(gm);

      // compute `connector.roomIds` before `roomGraph`
      const connectors = gm.doors.concat(gm.windows);
      connectors.forEach((connector, connectorId) => {
        const [inFrontRoomId, behindRoomId] = connector.entries.map(localPoint =>
          gmsData.findRoomIdContaining(gm.key, tmpVec1.copy(localPoint))
        );
        connector.roomIds = [inFrontRoomId, behindRoomId];
        // console.log(gm.key, connector.meta.door ? 'door' : 'window', connectorId, inFrontRoomId, behindRoomId);
      });
      gmData.roomGraph = RoomGraphClass.from(gm, `${gm.key}: `);

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
    /**
     * @param {Geomorph.Layout} gm 
     */
    drawHitCanvas(gm) {
      const ct = gmsData[gm.key].hitCtxt;

      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);

      ct.setTransform(worldToSguScale, 0, 0, worldToSguScale, -gm.pngRect.x * worldToSguScale, -gm.pngRect.y * worldToSguScale);
      // draw doors first to remove their extension into rooms
      gm.doors.forEach((door, doorId) => {
        drawPolygons(ct, door.poly, [`rgb(${hitTestRed.door}, 0, ${doorId})`, null])
      });
      gm.rooms.forEach((room, roomId) => {
        drawPolygons(ct, room, [`rgb(${hitTestRed.room}, ${roomId}, 255)`, null])
      });
    },
    /**
     * Test pixel in hit canvas.
     * @param {Geomorph.GeomorphKey} gmKey 
     * @param {Geom.Vect} localPoint local geomorph coords (meters)
     */
    findRoomIdContaining(gmKey, localPoint, includeDoors = false) {
      const ct = gmsData[gmKey].hitCtxt;
      const gm = gmsData.layout[gmKey]
      const { data: rgba } = ct.getImageData(// transform to canvas coords
        (localPoint.x - gm.pngRect.x) * worldToSguScale,
        (localPoint.y - gm.pngRect.y) * worldToSguScale,
        1, 1, { colorSpace: 'srgb' },
      );
      // console.log({ gmKey, localPoint, rgba: Array.from(rgba) });
      if (rgba[0] === hitTestRed.room) {// (0, roomId, 255, 1)
        return rgba[1];
      } else if (includeDoors === true && rgba[0] === hitTestRed.door) {// (255, 0, doorId, 1)
        // choose 1st roomId
        return gm.doors[rgba[2]].roomIds.find(x => typeof x === 'number') ?? null;
      } else {
        return null;
      }
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
