import * as THREE from 'three';
import { doorDepth, doorHeight, gmHitTestExtraScale, hitTestRed, hullDoorDepth, wallHeight, worldToSguScale } from "./const";
import { mapValues, pause, warn } from "./generic";
import { drawPolygons } from "./dom";
import { Poly } from '../geom';
import { geom, tmpVec1 } from "./geom";
import { geomorph } from "./geomorph";
import { BaseGraph } from '../graph/base-graph';
import { RoomGraphClass } from "../graph/room-graph";
import { helper } from './helper';

export default function createGmsData() {
  const gmsData = {
    ...mapValues(helper.toGmNum, (_, gmKey) => ({ ...emptyGmData, gmKey })),
    /** Total number of doors, each being a single quad (🔔 may change):  */
    doorCount: 0,
    /** Total number of obstacles, each being a single quad:  */
    obstaclesCount: 0,
    /** This induces the floor/ceil texture array ordering */
    seenGmKeys: /** @type {Geomorph.GeomorphKey[]} */ ([]),
    /** Total number of walls, where each wall is a single quad:  */
    wallCount: 0,
    /** Per gmId, total number of wall line segments:  */
    wallPolySegCounts: /** @type {number[]} */ ([]),
    
    /**
     * Recomputed (dev only) onchange geomorphs.json or edit create-gms-data
     * @param {Geomorph.Layout} gm
     * This is the "incoming" value.
     */
    async computeGmData(gm) {
      const gmData = gmsData[gm.key];
      gmsData.seenGmKeys.push(gm.key);

      gmData.doorSegs = gm.doors.map(({ seg }) => seg);
      gmData.polyDecals = gm.unsorted.filter(x => x.meta.poly === true);
      gmData.wallSegs = [
        ...gm.walls.flatMap((x) => x.lineSegs.map(seg => ({ seg, meta: x.meta }))),
        ...gm.doors.flatMap(connector => this.getLintelSegs(connector)),
        ...gm.windows.flatMap(connector => this.getWindowSegs(connector)),
      ];

      gmData.wallPolyCount = gm.walls.length;

      gmData.wallPolySegCounts = gm.walls.map(({ outline, holes }) =>
        outline.length + holes.reduce((sum, hole) => sum + hole.length, 0)
      );
      // lintels (2 quads per door):
      gmData.wallPolySegCounts.push(2 * gm.doors.length);
      // windows (upper/lower, may not be quads):
      gmData.wallPolySegCounts.push(2 * gm.windows.reduce((sum, x) => sum + x.poly.outline.length, 0));

      const nonHullWallsTouchCeil = gm.walls.filter(x => x.meta.hull !== true && x.meta.hollow !== true &&
        (x.meta.h === undefined || (x.meta.y + x.meta.h === wallHeight)) // touches ceiling
      );
      gmData.tops = {
        broad: gm.walls.filter(x => x.meta.broad === true),
        hull: Poly.union(gm.walls.filter(x => x.meta.hull).concat
          (gm.hullDoors.map(x => x.computeThinPoly()))
        ),
        nonHull: Poly.union(nonHullWallsTouchCeil
          .concat(gm.doors.map(door => door.computeThinPoly()))
        ).flatMap(x => geom.createInset(x, 0.02)),
        window: gm.windows.map(window => geom.createInset(window.poly, 0.005)[0]),
      };

      // canvas for quick "point -> roomId", "point -> doorId" computation
      gmData.hitCtxt ??= /** @type {CanvasRenderingContext2D} */ (
        document.createElement('canvas').getContext('2d', { willReadFrequently: true })
      );
      const bounds = gm.pngRect.clone().scale(worldToSguScale * gmHitTestExtraScale);
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

    /** Dispose `GmData` lookup. */
    dispose() {
      for (const gmKey of geomorph.gmKeys) {
        Object.entries(gmsData[gmKey]).forEach(([k, v]) => {
          if (Array.isArray(v)) {
            v.length = 0;
          } else if (v instanceof CanvasRenderingContext2D) {
            // console.log(`🔔 disposing canvas: ${k}`);
            v.canvas.width = v.canvas.height = 0;
          } else if (v instanceof THREE.Texture) {
            v.dispose();
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

      const scale = worldToSguScale * gmHitTestExtraScale;
      ct.setTransform(scale, 0, 0, scale, -gm.pngRect.x * scale, -gm.pngRect.y * scale);
      // draw doors first to remove their extension into rooms
      gm.doors.forEach((door, doorId) =>
        drawPolygons(ct, door.poly, [`rgb(${hitTestRed.door}, 0, ${doorId})`, null])
      );
      ct.lineWidth = 0.025; // 🔔 larger rooms so walls lie inside
      gm.rooms.forEach((room, roomId) =>
        drawPolygons(ct, room, [`rgb(${hitTestRed.room}, ${roomId}, 255)`, `rgb(${hitTestRed.room}, ${roomId}, 255)`])
      );
    },
    /**
     * Lookup pixel in "hit canvas"
     * @param {Geomorph.Layout} gm
     * @param {Geom.VectJson} localPoint local geomorph coords (meters)
     */
    findRoomIdContaining(gm, localPoint, includeDoors = false) {
      const ct = gmsData[gm.key].hitCtxt;
      const scale = worldToSguScale * gmHitTestExtraScale;
      const { data: rgba } = ct.getImageData(// transform to canvas coords
        (localPoint.x - gm.pngRect.x) * scale,
        (localPoint.y - gm.pngRect.y) * scale,
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
    /**
     * Two wall segments representing lintels i.e. wall above each door
     * @param {Geomorph.Connector} connector 
     * @returns {{ seg: [Geom.Vect, Geom.Vect]; meta: Meta }[]}
     */
    getLintelSegs({ seg: [u, v], normal, meta }) {
      const depths = lintelDepths[meta.hull === true ? 'hull' : 'nonHull'];
      meta = { ...meta, y: doorHeight, h: wallHeight - doorHeight };
      return [
        { seg: /** @type {[Geom.Vect, Geom.Vect]} */ (
            [v, u].map(p => p.clone().addScaled(normal, +1 * 0.5 * depths[0]))
          ), meta },
        { seg: /** @type {[Geom.Vect, Geom.Vect]} */ (
            [u, v].map(p => p.clone().addScaled(normal, -1 * 0.5 * depths[1]))
          ), meta },
      ];
    },
    /**
     * @param {Geomorph.Connector} connector 
     * @returns {{ seg: [Geom.Vect, Geom.Vect]; meta: Meta }[]}
     */
    getWindowSegs(connector) {
      // (connector => connector.poly.lineSegs.map(seg => ({ seg, meta: connector.meta }))
      const { poly: { lineSegs }, meta } = connector;
      const yBot = typeof meta.y === 'number' ? meta.y : 0.1;
      const yTop = typeof meta.h === 'number' ? yBot + meta.h : wallHeight - 0.1;
      return [
        ...lineSegs.map(seg => ({ seg, meta: {...connector.meta, y: 0, h: yBot } })),
        ...lineSegs.map(seg => ({ seg, meta: {...connector.meta, y: yTop, h: wallHeight - yTop } })),
      ];
    },
    /**
     * @param {Geomorph.GeomorphKey} gmKey 
     * @returns {number}
     */
    getTextureId(gmKey) {
      return gmsData.seenGmKeys.indexOf(gmKey);
    }
  };
  return gmsData;
};

const lintelDepths = {
  /**
   * 1st ~ hull door normal i.e. points outwards.
   * We lessen the depth to avoid z-fighting adjacent hull door.
   */
  hull: [hullDoorDepth - 0.01, hullDoorDepth],
  nonHull: [doorDepth, doorDepth],
};

/** @type {GmData} */
const emptyGmData = {
  gmKey: 'g-101--multipurpose', // overridden
  doorSegs: [],
  hitCtxt: /** @type {*} */ (null),
  navPoly: undefined,
  polyDecals: [],
  roomGraph: new RoomGraphClass(),
  tops: { broad: [], hull: [], nonHull: [], window: [] },
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
 * @property {{ broad: Geom.Poly[]; hull: Geom.Poly[]; nonHull: Geom.Poly[]; window: Geom.Poly[]; }} tops
 * @property {Geom.Poly[]} polyDecals
 * @property {import('../graph/room-graph').RoomGraphClass} roomGraph
 * @property {boolean} unseen Has this geomorph never occurred in any map so far?
 * @property {{ seg: [Geom.Vect, Geom.Vect]; meta: Meta; }[]} wallSegs
 * - `gm.walls` segs
 * - lintels i.e. 2 segs per door in `gm.doors`
 * - `gm.windows` segs
 * @property {number} wallPolyCount Number of wall polygons in geomorph, where each wall can have many line segments
 * @property {number[]} wallPolySegCounts Per wall, number of line segments
 */
