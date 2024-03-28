import * as THREE from "three";
import { Line2, LineGeometry, LineMaterial } from "three-stdlib";

/**
 * 🚧 final path vertex
 * https://github.com/donmccurdy/three-pathfinding/blob/main/src/PathfindingHelper.js
 */
export default class NavPathHelper extends THREE.Object3D {
  pathMarkers = new THREE.Object3D();

  linesGeometry = new LineGeometry();

  /** @type {THREE.Mesh[]} */
  unusedNodes = [];

  constructor() {
    super();

    this.pathMarkers.visible = false;
    this.add(this.pathMarkers);
  }

  /**
   * @param {THREE.Vector3Like[]} path
   */
  setPath(path) {
    this.pathMarkers.children.forEach((x) => {
      x.visible = false;
      x.name === navPathNodeName && x instanceof THREE.Mesh && this.unusedNodes.push(x);
    });

    this.pathMarkers.remove(...this.pathMarkers.children);
    // Draw debug lines
    this.linesGeometry.dispose();
    this.linesGeometry = new LineGeometry();
    this.linesGeometry.setPositions(path.flatMap(({ x, y, z }) => [x, y + GROUND_OFFSET, z]));

    this.pathMarkers.add(new Line2(this.linesGeometry, pathLineMaterial));

    // Add nodes 🔔 .add() doesn't like empty args
    if (this.unusedNodes.length) {
      this.pathMarkers.add(...this.unusedNodes.splice(0, path.length));
    }

    if (this.pathMarkers.children.length - 1 < path.length) {
      this.pathMarkers.add(
        ...path.slice(this.pathMarkers.children.length).map(() =>
          Object.assign(new THREE.Mesh(pathPointGeometry, pathPointMaterial), {
            name: navPathNodeName,
          })
        )
      );
    }

    this.pathMarkers.children.slice(1).forEach((x, i) => {
      x.visible = true;
      x.position.copy(path[i]);
      x.position.y += GROUND_OFFSET;
    });
    this.pathMarkers.visible = true;
  }

  dispose() {
    this.unusedNodes.length = 0;
    this.pathMarkers.remove(...this.pathMarkers.children);
    this.linesGeometry.dispose();
  }
}

const colors = {
  // TARGET: 0xdccb18,
  PATH: 0x00a3af,
  WAYPOINT: 0x555555,
  // CLAMPED_STEP: 0xdcd3b2,
  // CLOSEST_NODE: 0x43676b,
};

const pathLineMaterial = new LineMaterial({
  color: colors.PATH,
  linewidth: 0.01,
  vertexColors: true,
});
const pathPointMaterial = new THREE.MeshBasicMaterial({ color: colors.WAYPOINT });
const pathPointGeometry = new THREE.SphereGeometry(0.08);

const GROUND_OFFSET = 0.01;

const navPathNodeName = "NavPathNode";
