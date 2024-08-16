/**
 * Based on: https://github.com/michealparks/sword
 */
import RAPIER, { ColliderDesc, RigidBodyType } from '@dimforge/rapier3d-compat'
import { geomorphGridMeters, glbMeta, wallHeight } from '../service/const';
import { info, warn, debug } from "../service/generic";
import { fetchGeomorphsJson } from '../service/fetch-assets';
import { geomorphService } from '../service/geomorph';
import { addBodyKeyUidRelation, npcToBodyKey } from '../service/rapier';
import { helper } from '../service/helper';

const selfTyped = /** @type {WW.WorkerGeneric<WW.MsgFromPhysicsWorker, WW.MsgToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const config = {
  fps: 60,
  agentHeight: glbMeta.height * glbMeta.scale,
  agentRadius: glbMeta.radius * glbMeta.scale * (2/3),
};

/** @type {State} */
const state = {
  world: /** @type {*} */ (undefined),
  eventQueue: /** @type {*} */ (undefined),

  bodyHandleToKey: new Map(),
  bodyKeyToBody: new Map(),
  bodyKeyToCollider: new Map(),
  bodyKeyToUid: {},
  bodyUidToKey: {},

};

/** @param {MessageEvent<WW.MsgToPhysicsWorker>} e */
async function handleMessages(e) {
  const msg = e.data;

  if (state.world === undefined && msg.type !== 'setup-physics-world') {
    return; // Fixes HMR of this file
  }
  if (msg.type !== 'send-npc-positions') {
    info("worker received message", msg); // 🔔 Debug
  }

  switch (msg.type) {
    case "add-npcs":
      for (const npc of msg.npcs) {
        if (npcToBodyKey(npc.npcKey) in state.bodyKeyToUid) {
          warn(`physics worker: ${msg.type}: cannot re-add body (${npc.npcKey})`)
          continue;
        }
        const body = createRigidBody({
          type: RAPIER.RigidBodyType.KinematicPositionBased,
          geomDef: {
            type: 'cylinder',
            halfHeight: config.agentHeight / 2,
            radius: config.agentRadius,
          },
          position: { x: npc.position.x, y: config.agentHeight / 2, z: npc.position.z },
          userData: {
            npc: true,
            bodyKey: npcToBodyKey(npc.npcKey),
            bodyUid: addBodyKeyUidRelation(npcToBodyKey(npc.npcKey), state),
          },
        });
      }
      break;
    case "remove-npcs":
      // 🔔 no need to remove when not moving (can set asleep)
      for (const npcKey of msg.npcKeys) {
        const body = state.bodyKeyToBody.get(npcToBodyKey(npcKey));
        if (body !== undefined) {
          state.bodyHandleToKey.delete(body.handle);
          state.bodyKeyToBody.delete(npcToBodyKey(npcKey));
          state.bodyKeyToCollider.delete(npcToBodyKey(npcKey));
          state.world.removeRigidBody(body);
        }
      }
    break;
    case "send-npc-positions": {
      // set kinematic body positions
      let npcBodyKey = /** @type {WW.PhysicsBodyKey} */ ('');
      let position = /** @type {{ x: number; y: number; z: number;  }} */ ({});
      // decode: [npcBodyUid, positionX, positionY, positionZ, ...]
      for (const [index, value] of msg.positions.entries()) {
        switch (index % 4) {
          case 0: npcBodyKey = state.bodyUidToKey[value]; break;
          case 1: position.x = value; break;
          case 2: position.y = config.agentHeight/2; break; // overwrite y
          case 3:
            position.z = value;
            /** @type {RAPIER.RigidBody} */ (state.bodyKeyToBody.get(npcBodyKey))
              .setTranslation(position, true) // awaken on move
            ;
            break;
        }
      }
      stepWorld();
      break;
    }
    case "setup-physics-world": {
      await setupWorld(msg.mapKey, msg.npcs);
      selfTyped.postMessage({ type: 'world-is-setup' });
      break;
    }
    default:
      info("physics worker: unhandled:", msg);
      break;
  }
}

function stepWorld() {  
  state.world.step(state.eventQueue);

  const collisionStart = /** @type {WW.NpcCollisionResponse['collisionStart']} */ ([]);
  const collisionEnd = /** @type {WW.NpcCollisionResponse['collisionEnd']} */ ([]);
  let collided = false;
  
  state.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    collided = true;
    const bodyKey1 = /** @type {WW.PhysicsBodyKey} */ (state.bodyHandleToKey.get(handle1));
    const bodyKey2 = /** @type {WW.PhysicsBodyKey} */ (state.bodyHandleToKey.get(handle2));

    // 🔔 currently only have npcs and door inside/nearby sensors
    (started === true ? collisionStart : collisionEnd).push(
      bodyKey1.startsWith('npc')
        ? { npcKey: bodyKey1.slice('npc '.length), otherKey: bodyKey2 }
        : { npcKey: bodyKey2.slice('npc '.length), otherKey: bodyKey1 }
    );
  });

  if (/** @type {boolean} */ (collided) === true) {
    selfTyped.postMessage({
      type: 'npc-collisions',
      collisionStart,
      collisionEnd,
    });
  }
}

/**
 * @param {string} mapKey 
 * @param {WW.NpcDef[]} npcs
 */
async function setupWorld(mapKey, npcs) {

  if (!state.world) {
    await RAPIER.init();
    state.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    state.world.timestep = 1 / config.fps; // in seconds
    state.eventQueue = new RAPIER.EventQueue(true);
  } else {
    state.world.forEachRigidBody(rigidBody => state.world.removeRigidBody(rigidBody));
    state.world.forEachCollider(collider => state.world.removeCollider(collider, false));
    state.bodyKeyToBody.clear();
    state.bodyKeyToCollider.clear();
    state.bodyHandleToKey.clear();
    state.world.bodies.free();
    state.world.colliders.free();
  }

  const geomorphs = geomorphService.deserializeGeomorphs(await fetchGeomorphsJson());
  const mapDef = geomorphs.map[mapKey];
  const gms = mapDef.gms.map(({ gmKey, transform }, gmId) =>
    geomorphService.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
  );

  // door sensors: nearby ✅ inside 🚧 
  const gmDoorBodies = gms.map((gm, gmId) => 
    gm.doors.map((door, doorId) => {
      const center = gm.matrix.transformPoint(door.center.clone());
      const bodyKey = /** @type {const} */ (`nearby ${helper.getGmDoorKey(gmId, doorId)}`);
      return createRigidBody({
        type: RAPIER.RigidBodyType.Fixed,
        // hull door sensor ~ 2x2 grid
        // non-hull door sensor ~ 1x1 grid
        geomDef: {
          type: 'cylinder',
          radius: door.meta.hull === true ? geomorphGridMeters : geomorphGridMeters / 2,
          halfHeight: wallHeight / 2,
        },
        position: { x: center.x, y: wallHeight/2, z: center.y },
        userData: {
          npc: false,
          bodyKey,
          bodyUid: addBodyKeyUidRelation(bodyKey, state),
        },
      })
    })
  );

  // on worker hmr we need to restore npcs
  for (const { npcKey, position } of npcs) {
    const bodyKey = npcToBodyKey(npcKey);
    createRigidBody({
      type: RigidBodyType.KinematicPositionBased,
      geomDef: {
        type: 'cylinder',
        halfHeight: config.agentHeight / 2,
        radius: config.agentRadius,
      },
      position,
      userData: {
        npc: true,
        bodyKey,
        bodyUid: addBodyKeyUidRelation(bodyKey, state),
      },
    });
  }

  stepWorld(); // fires initial collisions
}

/**
 * Create:
 * - cylindrical static
 * - cylindrical kinematic-position sensor.
 * @param {object} opts
 * @param {RAPIER.RigidBodyType.Fixed | RAPIER.RigidBodyType.KinematicPositionBased} opts.type
 * @param {WW.PhysicsBodyGeom} opts.geomDef
 * @param {import('three').Vector3Like} opts.position
 * @param {BodyUserData} opts.userData
 */
function createRigidBody({ type, geomDef, position, userData }) {

  const bodyDescription = new RAPIER.RigidBodyDesc(type)
    .setCanSleep(true)
    .setCcdEnabled(false)
  ;

  const colliderDescription = (
    geomDef.type === 'cylinder'
      ? ColliderDesc.cylinder(geomDef.halfHeight, geomDef.radius)
      : ColliderDesc.cuboid(...geomDef.halfDim)
    ).setDensity(0)
    .setFriction(0)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
    .setRestitution(0)
    .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
    .setSensor(true)
    // .setCollisionGroups(1) // 👈 breaks things
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED)
  ;

  const rigidBody = state.world.createRigidBody(bodyDescription);
  const collider = state.world.createCollider(colliderDescription, rigidBody);

  collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED);

  rigidBody.userData = userData;

  state.bodyKeyToBody.set(userData.bodyKey, rigidBody);
  state.bodyKeyToCollider.set(userData.bodyKey, collider);
  state.bodyHandleToKey.set(rigidBody.handle, userData.bodyKey);

  rigidBody.setTranslation(position, true);

  return /** @type {RAPIER.RigidBody & { userData: BodyUserData }} */ (rigidBody);
}

function debugWorld() {
  debug('world',
    state.world.bodies.getAll().map((x) => ({
      userData: x.userData,
      position: {...x.translation()},
      enabled: x.isEnabled(),
    }))
  );
}

if (typeof window === 'undefined') {
  info("🤖 physics worker started", import.meta.url);
  selfTyped.addEventListener("message", handleMessages);
}

/**
 * @typedef BodyUserData
 * @property {WW.PhysicsBodyKey} bodyKey
 * @property {number} bodyUid This is the numeric hash of `bodyKey`
 * @property {boolean} npc
 */

/**
 * @typedef {BaseState & import('../service/rapier').PhysicsBijection} State
 */

/**
 * @typedef BaseState
 * @property {RAPIER.World} world
 * @property {RAPIER.EventQueue} eventQueue
 * @property {Map<number, WW.PhysicsBodyKey>} bodyHandleToKey
 * @property {Map<WW.PhysicsBodyKey, RAPIER.Collider>} bodyKeyToCollider
 * @property {Map<WW.PhysicsBodyKey, RAPIER.RigidBody>} bodyKeyToBody
 * //@property {Set<string>} npcKeys A subset of body keys
 */
