import * as THREE from "three";
import { dampLookAt } from "maath/easing";
import { info } from "../service/generic";

/**
 * https://github.com/abhicominin/Character-Controller-three.js/blob/52d9893f890ac974c3241e3ca98fc68586f2e392/src/characterControls.js#L8
 */
export default class CharacterController {

  /**
   * @param {object} opts
   * @param {THREE.Group} opts.model 
   * @param {THREE.AnimationMixer} opts.mixer 
   * @param {Record<AnimKey, THREE.AnimationAction>} opts.animationMap 
   * @param {AnimKey} opts.initialAction 
   */
  constructor({
    model,
    mixer,
    animationMap,
    initialAction
  }) {
    this.shouldRun = true;
    this.currentAction = initialAction;
    this.target = null;

    this.walkDir = new THREE.Vector3();
    this.rotAxis = new THREE.Vector3(0, 1, 0);
    this.rotQuat = new THREE.Quaternion();
    this.worldPos = new THREE.Vector3();

    this.fadeDuration = 0.2
    this.walkSpeed = 2;
    this.runSpeed = 5

    this.model = model;
    this.mixer = mixer;
    this.animationMap = animationMap;
    
    this.animationMap[this.currentAction].play();
  }

  /**
   * Radians
   * @param {Record<DirectionKey, boolean>} keysPressed 
   */
  getOffsetAngle({ w, a, s, d}) {
    if (w) {
      if (a) return  1/4 * Math.PI;
      if (d) return -1/4 * Math.PI;
      return 0;
    }
    if (s) {
      if (a) return  3/4 * Math.PI;
      if (d) return -3/4 * Math.PI;
      return Math.PI;
    }
    if (a) {
      return Math.PI/2;
    }
    if (d) {
      return -Math.PI/2;
    }
    return 0;
  }

  /**
   * Move in a straight line towards towards non-null target, or cancel.
   * @param {null | THREE.Vector3Like} target 
   */
  setTarget(target) {
    info('setTarget', target);
    this.target = target === null ? null : (new THREE.Vector3()).copy(target);
  }
  
  /**
   * @param {number} deltaMs 
   */
  updateOnTarget(deltaMs) {
    let nextAction = this.currentAction;
    this.model.getWorldPosition(this.worldPos);

    if (this.target === null) {
      nextAction = 'Idle';
    } else if (this.worldPos.distanceTo(this.target) < 0.1) {
      this.target = null;
      nextAction = 'Idle';
    } else {
      nextAction = this.shouldRun ? 'Run' : 'Walk';
    }

    if (this.currentAction !== nextAction) {
      const currAnim = this.animationMap[this.currentAction];
      const nextAnim = this.animationMap[nextAction];
      currAnim.fadeOut(this.fadeDuration);
      nextAnim.reset().fadeIn(this.fadeDuration).play();
      this.currentAction = nextAction;
    }

    this.mixer.update(deltaMs);

    if (this.target !== null) {
      dampLookAt(this.model, this.target, 0.1, deltaMs);

      this.walkDir.copy(this.target).sub(this.worldPos).normalize();
      const speed = this.currentAction === 'Run' ? this.runSpeed : this.walkSpeed;
      this.model.position.x += this.walkDir.x * speed * deltaMs
      this.model.position.z += this.walkDir.z * speed * deltaMs
    }

  }

  /**
   * @param {number} deltaMs 
   * @param {Record<DirectionKey, boolean>} keysPressed 
   */
  updateOnKey(deltaMs, keysPressed) {
    const keyPressed = DIRECTIONS.some((key) => keysPressed[key] === true);

    const nextAction = keyPressed && this.shouldRun
      ? 'Run'
      : keyPressed ? 'Walk' : 'Idle'
    ;

    if (this.currentAction !== nextAction) {
      const currAnim = this.animationMap[this.currentAction];
      const nextAnim = this.animationMap[nextAction];
      currAnim.fadeOut(this.fadeDuration);
      nextAnim.reset().fadeIn(this.fadeDuration).play();
      this.currentAction = nextAction;
    }

    this.mixer.update(deltaMs);

    if (this.currentAction === 'Run' || this.currentAction === 'Walk') {
      const targetAngle = this.getOffsetAngle(keysPressed);

      // Turn towards target angle
      this.rotQuat.setFromAxisAngle(this.rotAxis, targetAngle);
      this.model.quaternion.rotateTowards(this.rotQuat, 0.2);

      // Compute walk direction
      this.walkDir.set(0, 0, -1).applyAxisAngle(this.rotAxis , targetAngle);

      // Move
      const speed = this.currentAction === 'Run' ? this.runSpeed : this.walkSpeed;
      const deltaX = this.walkDir.x * speed * deltaMs;
      const deltaZ = this.walkDir.z * speed * deltaMs;
      this.model.position.x += deltaX
      this.model.position.z += deltaZ
    }
  }

  /** @type {boolean} */ shouldRun
  /** @type {AnimKey} */ currentAction
  /** @type {null | THREE.Vector3} */ target

  /** @type {THREE.Vector3} */ walkDir
  /** @type {THREE.Vector3} */ rotAxis
  /** @type {THREE.Quaternion} */ rotQuat
  /** @type {THREE.Vector3} */ worldPos

  /** @type {number} */ fadeDuration
  /** @type {number} */ walkSpeed
  /** @type {number} */ runSpeed

  /** @type {THREE.Group} */ model
  /** @type {THREE.AnimationMixer} */ mixer
  /** @type {Record<AnimKey, THREE.AnimationAction>} */ animationMap

}

const W = "w";
const A = "a";
const S = "s";
const D = "d";
const DIRECTIONS = /** @type {const} */ ([W, A, S, D]);

/**
 * @typedef {'Idle' | 'Walk' | 'Run'} AnimKey
 */

/**
 * @typedef {(typeof DIRECTIONS)[*]} DirectionKey
 */