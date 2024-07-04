import { mapValues } from "./generic";
import { geomorphService } from "./geomorph";
import { RoomGraphClass } from "../graph/room-graph";

/**
 * @returns {Geomorph.GmsData}
 */
export default function createGmsData() {
  return {
    ...mapValues(geomorphService.toGmNum, (_, gmKey) => ({ ...emptyGmData, gmKey })),
  
    /** Total number of doors, each being a single quad (🔔 may change):  */
    doorCount: 0,
    /** Total number of obstacles, each being a single quad:  */
    obstaclesCount: 0,
    /** Total number of walls, where each wall is a single quad:  */
    wallCount: 0,
    /** Per gmId, total number of wall line segments:  */
    wallPolySegCounts: /** @type {number[]} */ ([]),
  };
};

/** @type {Geomorph.GmData} */
const emptyGmData = {
  gmKey: 'g-101--multipurpose',
  doorSegs: [], doorCeilTops: [],
  hitCtxt: /** @type {*} */ (null),
  navPoly: undefined, nonHullCeilTops: [], polyDecals: [],
  roomGraph: new RoomGraphClass(),
  unseen: true,
  wallPolyCount: 0, wallPolySegCounts: [], wallSegs: [],
};
