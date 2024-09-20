/**
 * Based on: https://github.com/michealparks/sword
 */
import RAPIER, { ColliderDesc, RigidBodyType } from '@dimforge/rapier3d-compat'
import { geomorphGridMeters, glbMeta, wallHeight, wallOutset } from '../service/const';
import { info, warn, debug, testNever } from "../service/generic";
import { fetchGeomorphsJson } from '../service/fetch-assets';
import { geomorph } from '../service/geomorph';
import { addBodyKeyUidRelation, npcToBodyKey } from '../service/rapier';
import { helper } from '../service/helper';

const selfTyped = /** @type {WW.WorkerGeneric<WW.MsgFromPhysicsWorker, WW.MsgToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const config = {
  fps: 60,
  agentHeight: glbMeta.height * glbMeta.scale,
  // agentRadius: glbMeta.radius * glbMeta.scale * 0.5,
  agentRadius: 0.25,
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
  // 🔔 avoid logging 60fps messages
  if (msg.type !== 'send-npc-positions') {
    debug("🤖 physics worker received:", JSON.stringify(msg));
  }

  switch (msg.type) {
    case "add-colliders":
      for (const { colliderKey, geom, position } of msg.colliders) {
        /** @type {WW.PhysicsBodyKey} */
        const bodyKey = geom.type === 'cuboid' ? `rect ${colliderKey}` : `circle ${colliderKey}`;
  
        if (!(bodyKey in state.bodyKeyToUid)) {
          const _body = createRigidBody({
            type: RAPIER.RigidBodyType.Fixed,
            geomDef: geom,
            position: {
              x: position.x, // place static collider on floor:
              y: geom.type === 'cylinder' ? geom.halfHeight : geom.halfDim[1],
              z: position.y,
            },
            userData: {
              npc: false,
              bodyKey,
              bodyUid: addBodyKeyUidRelation(bodyKey, state),
            },
          });
        } else {
          warn(`physics worker: ${msg.type}: cannot re-add body (${bodyKey})`)
        }
      }
      break;
    case "add-npcs":
      for (const npc of msg.npcs) {
        const bodyKey = npcToBodyKey(npc.npcKey);

        if (!(bodyKey in state.bodyKeyToUid)) {
          const _body = createRigidBody({
            type: RAPIER.RigidBodyType.KinematicPositionBased,
            geomDef: {
              type: 'cylinder',
              halfHeight: config.agentHeight / 2,
              radius: config.agentRadius,
            },
            position: { x: npc.position.x, y: config.agentHeight / 2, z: npc.position.z },
            userData: {
              npc: true,
              bodyKey,
              bodyUid: addBodyKeyUidRelation(bodyKey, state),
            },
          });
        } else {
          warn(`physics worker: ${msg.type}: cannot re-add body: ${bodyKey}`)
        }
      }
      break;
    case "remove-bodies":
      for (const bodyKey of msg.bodyKeys) {
        const body = state.bodyKeyToBody.get(bodyKey);
        if (body !== undefined) {
          state.bodyHandleToKey.delete(body.handle);
          state.bodyKeyToBody.delete(bodyKey);
          state.bodyKeyToCollider.delete(bodyKey);
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
    case "setup-physics-world":
      await setupWorld(msg.mapKey, msg.npcs);
      selfTyped.postMessage({ type: 'world-is-setup' });
      break;
    default:
      info("physics worker: unhandled:", msg);
      throw testNever(msg);
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
    // state.world.bodies.free();
    // state.world.colliders.free();
  }

  const geomorphs = geomorph.deserializeGeomorphs(await fetchGeomorphsJson());
  const mapDef = geomorphs.map[mapKey];
  const gms = mapDef.gms.map(({ gmKey, transform }, gmId) =>
    geomorph.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
  );

  // door sensors: nearby ✅ inside ✅
  const gmDoorBodies = gms.map((gm, gmId) => gm.doors.flatMap((door, doorId) => {
    const center = gm.matrix.transformPoint(door.center.clone());
    const gdKey = helper.getGmDoorKey(gmId, doorId);
    const nearbyKey = /** @type {const} */ (`nearby ${gdKey}`);
    const insideKey = /** @type {const} */ (`inside ${gdKey}`);

    return [
      // hull door sensor ~ 2x2 grid
      // non-hull door sensor ~ 1x1 grid
      createRigidBody({
        type: RAPIER.RigidBodyType.Fixed,
        geomDef: {
          type: 'cylinder',
          radius: door.meta.hull === true ? geomorphGridMeters : geomorphGridMeters / 2,
          halfHeight: wallHeight / 2,
        },
        position: { x: center.x, y: wallHeight/2, z: center.y },
        userData: {
          npc: false,
          bodyKey: nearbyKey,
          bodyUid: addBodyKeyUidRelation(nearbyKey, state),
        },
      }),
      createRigidBody({
        type: RAPIER.RigidBodyType.Fixed,
        geomDef: {
          type: 'cuboid',
          halfDim: [(door.baseRect.width - 2 * wallOutset)/2, wallHeight / 2, door.baseRect.height/2],
        },
        position: { x: center.x, y: wallHeight/2, z: center.y },
        angle: door.angle,
        userData: {
          npc: false,
          bodyKey: insideKey,
          bodyUid: addBodyKeyUidRelation(insideKey, state),
        },
      }),
    ]
  }));

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
 * @param {number} [opts.angle] radians in XZ plane
 * @param {BodyUserData} opts.userData
 */
function createRigidBody({ type, geomDef, position, angle, userData }) {

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

  if (typeof angle === 'number') {
    rigidBody.setRotation(new RAPIER.Quaternion(0, -angle, 0, 1), false);
  }
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
