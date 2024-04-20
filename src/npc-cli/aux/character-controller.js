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
    this.shouldRun = false;
    this.currentAction = initialAction;
    this.target = null;

    this.walkDir = new THREE.Vector3();
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
  update(deltaMs) {
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

  /** @type {boolean} */ shouldRun
  /** @type {AnimKey} */ currentAction
  /** @type {null | THREE.Vector3} */ target

  /** @type {THREE.Vector3} */ walkDir
  /** @type {THREE.Vector3} */ worldPos

  /** @type {number} */ fadeDuration
  /** @type {number} */ walkSpeed
  /** @type {number} */ runSpeed

  /** @type {THREE.Group} */ model
  /** @type {THREE.AnimationMixer} */ mixer
  /** @type {Record<AnimKey, THREE.AnimationAction>} */ animationMap

}

/**
 * @typedef {'Idle' | 'Walk' | 'Run'} AnimKey
 */
