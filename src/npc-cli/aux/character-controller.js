import * as THREE from "three";

/**
 * https://github.com/abhicominin/Character-Controller-three.js/blob/52d9893f890ac974c3241e3ca98fc68586f2e392/src/characterControls.js#L8
 */
export default class CharacterControls {

  /**
   * @param {object} opts
   * @param {THREE.Group} opts.model 
   * @param {THREE.AnimationMixer} opts.mixer 
   * @param {Record<AnimKey, THREE.AnimationAction>} opts.animationMap 
   * @param {import('three-stdlib').OrbitControls} opts.orbitControls 
   * @param {THREE.PerspectiveCamera} opts.camera 
   * @param {AnimKey} opts.initialAction 
   */
  constructor({
    model,
    mixer,
    animationMap,
    orbitControls,
    camera,
    initialAction
  }) {
    this.walkDir = new THREE.Vector3();
    this.rotAxis = new THREE.Vector3(0, 1, 0);
    this.rotQuat = new THREE.Quaternion();
    this.camTarget = new THREE.Vector3();

    this.fadeDuration = 0.2
    this.walkSpeed = 2;
    this.runSpeed = 5

    this.canRun = true;
    this.model = model;
    this.mixer = mixer;
    this.animationMap = animationMap;
    this.currentAction = initialAction;
    
    this.animationMap[this.currentAction].play();

    this.orbitControls = orbitControls;
    this.camera = camera;
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
    return 0;
  }

  /**
   * @param {number} deltaMs 
   * @param {Record<DirectionKey, boolean>} keysPressed 
   */
  update(deltaMs, keysPressed) {
    const keyPressed = DIRECTIONS.some((key) => keysPressed[key] === true);

    const nextAction = keyPressed && this.canRun
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
      
      const modelCamAngle = Math.atan2(// 🚧 why not switched
        this.camera.position.x - this.model.position.x,
        this.camera.position.z - this.model.position.z,
      );
      const offsetAngle = this.getOffsetAngle(keysPressed);

      // Turn towards target angle
      this.rotQuat.setFromAxisAngle(this.rotAxis, modelCamAngle + offsetAngle);
      this.model.quaternion.rotateTowards(this.rotQuat, 0.2);

      // Compute walk direction
      this.camera.getWorldDirection(this.walkDir)
      this.walkDir.setY(0).normalize().applyAxisAngle( this.rotAxis , offsetAngle);

      // Move
      const speed = this.currentAction === 'Run' ? this.runSpeed : this.walkSpeed;
      const deltaX = this.walkDir.x * speed * deltaMs;
      const deltaZ = this.walkDir.z * speed * deltaMs;
      this.model.position.x += deltaX
      this.model.position.z += deltaZ

      this.updateCameraTarget(deltaX , deltaZ);
    }
  }

  /**
   * @param {number} deltaX 
   * @param {number} deltaY 
   */
  updateCameraTarget(deltaX, deltaY) {
    // // move camera
    // this.camera.position.x = deltaX
    // this.camera.position.z = deltaY

    // update camera target
    this.orbitControls.target = this.camTarget.set(
      this.model.position.x,
      this.model.position.y + 1,
      this.model.position.z,
    );
  }


    /** @type {THREE.Vector3} */ walkDir
    /** @type {THREE.Vector3} */ rotAxis
    /** @type {THREE.Quaternion} */ rotQuat
    /** @type {THREE.Vector3} */ camTarget

    /** @type {number} */ fadeDuration
    /** @type {number} */ walkSpeed
    /** @type {number} */ runSpeed

    /** @type {AnimKey} */ currentAction
    /** @type {boolean} */ canRun
    /** @type {THREE.Group} */ model
    /** @type {THREE.AnimationMixer} */ mixer
    /** @type {Record<AnimKey, THREE.AnimationAction>} */ animationMap

    /** @type {import('three-stdlib').OrbitControls} */ orbitControls
    /** @type {THREE.PerspectiveCamera} */ camera;

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