import * as THREE from 'three';
import { hitTestRed, wallHeight, worldToSguScale } from "./const";
import { mapValues, pause, warn } from "./generic";
import { drawPolygons } from "./dom";
import { geom, tmpVec1 } from "./geom";
import { Connector, geomorphService } from "./geomorph";
import { BaseGraph } from '../graph/base-graph';
import { RoomGraphClass } from "../graph/room-graph";

/**
 * @param {object} opts
 * @param {Record<Geomorph.GeomorphKey, GmData>} [opts.prevGmData]
 * Previous lookup to avoid recomputation
*/
export default function createGmsData({ prevGmData }) {
  const gmsData = {
    ...mapValues(geomorphService.toGmNum,
      (_, gmKey) => prevGmData?.[gmKey] ?? ({ ...emptyGmData, gmKey })
    ),
    
    /** Total number of doors, each being a single quad (🔔 may change):  */
    doorCount: 0,
    /** Total number of obstacles, each being a single quad:  */
    obstaclesCount: 0,
    /** Total number of walls, where each wall is a single quad:  */
    wallCount: 0,
    /** Per gmId, total number of wall line segments:  */
    wallPolySegCounts: /** @type {number[]} */ ([]),
    
    /**
     * Recomputed (dev only),
     * - onchange geomorphs.json
     * - on edit create-gms-data
     * @param {Geomorph.Layout} gm
     * This is the "incoming" value.
     */
    async computeGmData(gm) {
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
      // 🔔 technically can avoid recompute when only gmsDataChanged
      await pause(); 
      for (const connector of gm.doors) {
        connector.roomIds = /** @type {[number | null, number | null]} */ (connector.entries.map(
          localPoint => gmsData.findRoomIdContaining(gm, localPoint)
        ));
      }
      for (const connector of gm.windows) {
        connector.roomIds = /** @type {[number | null, number | null]} */ (connector.entries.map(
          localPoint => gmsData.findRoomIdContaining(gm, localPoint)
        ));
      }
      gmData.roomGraph = RoomGraphClass.from(gm, `${gm.key}: `);

      // attach meta.roomId to obstacles and decor
      await pause();
      for (const obstacle of gm.obstacles) {
        obstacle.meta.roomId ??= (gmsData.findRoomIdContaining(gm, obstacle.center) ?? -1);
      }
      for (const decor of gm.decor.concat(gm.labels)) {
        tmpVec1.set(decor.bounds2d.x + decor.bounds2d.width/2, decor.bounds2d.y + decor.bounds2d.height/2);
        decor.meta.roomId ??= (gmsData.findRoomIdContaining(gm, tmpVec1) ?? -1);
      }
      
      gmData.unseen = false;
    },
    /**
     * Recomputed when `w.gms` changes e.g. map changes
     * @param {Geomorph.LayoutInstance[]} gms
     */
    computeRoot(gms) {
      gmsData.doorCount = gms.reduce((sum, { key }) => sum + gmsData[key].doorSegs.length, 0);
      gmsData.wallCount = gms.reduce((sum, { key }) => sum + gmsData[key].wallSegs.length, 0);
      gmsData.obstaclesCount = gms.reduce((sum, { obstacles }) => sum + obstacles.length, 0);

      gmsData.wallPolySegCounts = gms.map(({ key: gmKey }) =>
        gmsData[gmKey].wallPolySegCounts.reduce((sum, count) => sum + count, 0),
      );
    },
    dispose() {
      for (const gmKey of geomorphService.gmKeys) {
        Object.values(gmsData[gmKey]).forEach(v => {
          if (Array.isArray(v)) {
            v.length = 0;
          } else if (v instanceof CanvasRenderingContext2D) {
            v.canvas.width = v.canvas.height = 0;
          } else if (v instanceof THREE.BufferGeometry) {
            v.dispose();
          } else if (v instanceof BaseGraph) {
            v.dispose();
          }
        });
      }
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
     * @param {Geomorph.Layout} gm
     * @param {Geom.VectJson} localPoint local geomorph coords (meters)
     */
    findRoomIdContaining(gm, localPoint, includeDoors = false) {
      const ct = gmsData[gm.key].hitCtxt;
      const { data: rgba } = ct.getImageData(// transform to canvas coords
        (localPoint.x - gm.pngRect.x) * worldToSguScale,
        (localPoint.y - gm.pngRect.y) * worldToSguScale,
        1, 1, { colorSpace: 'srgb' },
      );
      // console.log({ gmKey: gm.key, localPoint, rgba: Array.from(rgba) });
      if (rgba[3] === 0) {// ignore transparent
        return null;
      }
      if (rgba[0] === hitTestRed.room) {// (0, roomId, 255, 1)
        return rgba[1];
      }
      if (includeDoors === true && rgba[0] === hitTestRed.door) {
        // (255, 0, doorId, 1) -- we choose 1st roomId
        return gm.doors[rgba[2]].roomIds.find(x => typeof x === 'number') ?? null;
      }
      return null;
    },
  };
  return gmsData;
};

/** @type {GmData} */
const emptyGmData = {
  gmKey: 'g-101--multipurpose', // overridden
  doorSegs: [],
  doorCeilTops: [],
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
