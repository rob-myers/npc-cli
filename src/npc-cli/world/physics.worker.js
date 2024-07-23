/**
 * Based on: https://github.com/michealparks/sword
 */
import RAPIER, { ColliderDesc, RigidBodyType } from '@dimforge/rapier3d-compat'
import { glbMeta, wallHeight } from '../service/const';
import { error, info, warn, debug } from "../service/generic";
import { fetchGeomorphsJson } from '../service/fetch-assets';
import { geomorphService } from '../service/geomorph';
import { addBodyKeyUidRelation } from '../service/rapier';

const selfTyped = /** @type {WW.WorkerGeneric<WW.MsgFromPhysicsWorker, WW.MsgToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const config = {
  fps: 60,
  agentHeight: glbMeta.height * glbMeta.scale,
  agentRadius: glbMeta.radius * glbMeta.scale,
};

const state = {
  /** @type {Set<string>} A subset of body keys */
  npcKeys: new Set(),
  
  /** @type {Map<number, string>} */
  bodyHandleToKey: new Map(),
  /** @type {Map<string, RAPIER.Collider>} */
  bodyKeyToCollider: new Map(),
  /** @type {Map<string, RAPIER.RigidBody>} */
  bodyKeyToBody: new Map(),
  
  /** @type {RAPIER.World} */
  world: /** @type {*} */ (undefined),
  /** @type {RAPIER.EventQueue} */
  eventQueue: /** @type {*} */ (undefined),

  /** @type {import('./World').State['physics']['keyToNum']} */
  keyToNum: {},
  /** @type {import('./World').State['physics']['numToKey']} */
  numToKey: {},
};

/** @param {MessageEvent<WW.MsgToPhysicsWorker>} e */
async function handleMessages(e) {
  const msg = e.data;

  if (state.world === undefined && msg.type !== 'setup-physics-world') {
    return; // For hmr of this file
  }
  if (msg.type !== 'send-npc-positions') {
    info("worker received message", msg); // 🔔 Debug
  }

  switch (msg.type) {
    case "add-npcs":
      for (const npc of msg.npcs) {
        if (state.npcKeys.has(npc.npcKey) === true) {
          warn(`physics worker: ${msg.type}: cannot re-add body (${npc.npcKey})`)
          continue;
        }
        addBodyKeyUidRelation(npc.npcKey, state);
        state.npcKeys.add(npc.npcKey);
        const body = createRigidBody({
          type: RAPIER.RigidBodyType.KinematicPositionBased,
          halfHeight: config.agentHeight / 2,
          radius: config.agentRadius,
          position: { x: npc.position.x, y: config.agentHeight / 2, z: npc.position.z },
          userData: { npc: true, bodyKey: npc.npcKey },
        });
      }
      break;
    case "remove-npcs":
      // 🔔 no need to remove when not moving (can set asleep)
      for (const npcKey of msg.npcKeys) {
        state.npcKeys.delete(npcKey);
        const body = state.bodyKeyToBody.get(npcKey);
        if (body !== undefined) {
          state.bodyHandleToKey.delete(body.handle);
          state.bodyKeyToBody.delete(npcKey);
          state.bodyKeyToCollider.delete(npcKey);
          state.world.removeRigidBody(body);
        }
      }
    break;
    case "send-npc-positions": {
      // set kinematic body positions
      let npcKey = '';
      let position = /** @type {{ x: number; y: number; z: number;  }} */ ({});
      for (const [index, value] of msg.positions.entries()) {
        switch (index % 4) {
          case 0: npcKey = state.numToKey[value]; break;
          case 1: position.x = value; break;
          case 2: position.y = config.agentHeight/2; break; // overwrite y
          case 3:
            position.z = value;
            /** @type {RAPIER.RigidBody} */ (state.bodyKeyToBody.get(npcKey))
              .setTranslation(position, true)
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
    const bodyKey1 = /** @type {string} */ (state.bodyHandleToKey.get(handle1));
    const bodyKey2 = /** @type {string} */ (state.bodyHandleToKey.get(handle2));
    (started === true ? collisionStart : collisionEnd).push(
      state.npcKeys.has(bodyKey1) === true
        ? { npcKey: bodyKey1, otherKey: bodyKey2 }
        : { npcKey: bodyKey2, otherKey: bodyKey1 }
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

  const gmDoorCenters = gms.map(gm => // indexed by [gmId][doorId]
    gm.doors.map(({ center }) => gm.matrix.transformPoint(center.clone()))
  );

  // construct door bodies/colliders
  const gmDoorBodies = gmDoorCenters.map((centers, gmId) =>
    centers.map((center, doorId) => 
      createRigidBody({
        type: RAPIER.RigidBodyType.Fixed,
        radius: 1.5, // meters
        halfHeight: wallHeight / 2,
        position: { x: center.x, y: wallHeight/2, z: center.y },
        userData: { npc: false, bodyKey: geomorphService.getGmDoorKey(gmId, doorId) },
      })
    )
  );

  for (const { npcKey, position } of npcs) {
    createRigidBody({
      type: RigidBodyType.KinematicPositionBased,
      halfHeight: config.agentHeight / 2,
      radius: config.agentRadius,
      position,
      userData: { npc: true, bodyKey: npcKey },
    });
  }

  stepWorld();
}

/**
 * Create cylindrical static or kinematic-position sensor.
 * @template {{ bodyKey: string }} UserData
 * @param {object} opts
 * @param {RAPIER.RigidBodyType.Fixed | RAPIER.RigidBodyType.KinematicPositionBased} opts.type
 * @param {number} opts.halfHeight
 * @param {number} opts.radius
 * @param {import('three').Vector3Like} opts.position
 * @param {UserData} opts.userData
 */
function createRigidBody({ type, halfHeight, radius, position, userData }) {

  const bodyDescription = new RAPIER.RigidBodyDesc(type)
    .setCanSleep(true)
    .setCcdEnabled(false)
  ;

  const colliderDescription = ColliderDesc.cylinder(halfHeight, radius)
    .setDensity(0)
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

  return /** @type {RAPIER.RigidBody & { userData: UserData }} */ (rigidBody);
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
