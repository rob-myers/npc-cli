import * as THREE from "three";
import { Line2, LineGeometry, LineMaterial } from "three-stdlib";

/**
 * https://github.com/donmccurdy/three-pathfinding/blob/main/src/PathfindingHelper.js
 */
export default class NavPathHelper extends THREE.Object3D {
  /** Contains `Line2` and `Mesh` per node */
  group = new THREE.Group();
  linesGeometry = new LineGeometry();
  /** @type {THREE.Mesh[]} */
  unusedNodes = [];

  constructor() {
    super();

    this.group.visible = false;
    this.add(this.group);
  }

  /**
   * @param {THREE.Vector3Like[]} path
   */
  setPath(path) {
    this.group.children.forEach((x) => {
      x.visible = false;
      x.name === navPathNodeName && x instanceof THREE.Mesh && this.unusedNodes.push(x);
    });
    this.group.remove(...this.group.children);

    this.linesGeometry.setPositions(path.flatMap(({ x, y, z }) => [x, y + GROUND_OFFSET, z]));
    this.group.add(new Line2(this.linesGeometry, pathLineMaterial));

    if (this.unusedNodes.length) {
      this.group.add(...this.unusedNodes.splice(0, path.length));
    }

    if (this.group.children.length - 1 < path.length) {
      this.group.add(
        ...path.slice(this.group.children.length - 1).map(() =>
          Object.assign(new THREE.Mesh(pathPointGeometry, pathPointMaterial), {
            name: navPathNodeName,
          })
        )
      );
    }

    this.group.children.slice(1).forEach((x, i) => {
      x.visible = true;
      x.position.copy(path[i]);
      x.position.y += GROUND_OFFSET;
    });
    this.group.visible = true;
  }

  dispose() {
    this.unusedNodes.length = 0;
    this.group.remove(...this.group.children);
    this.linesGeometry.dispose();
  }
}

const colors = {
  PATH: 0x00aa00,
  WAYPOINT: 0xaa0000,
};

const pathLineMaterial = new LineMaterial({
  color: colors.PATH,
  linewidth: 0.01,
  // vertexColors: true,
});
const pathPointMaterial = new THREE.MeshBasicMaterial({ color: colors.WAYPOINT });
const pathPointGeometry = new THREE.SphereGeometry(0.08);

const GROUND_OFFSET = 0.01;

const navPathNodeName = "NavPathNode";
