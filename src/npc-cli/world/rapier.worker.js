/**
 * Based on: https://github.com/michealparks/sword
 */
import RAPIER, { ColliderDesc } from '@dimforge/rapier3d-compat'
import { glbMeta, wallHeight } from '../service/const';
import { error, info, warn } from "../service/generic";
import { fetchGeomorphsJson } from '../service/fetch-assets';
import { geomorphService } from '../service/geomorph';

info("physics worker started", import.meta.url);

const selfTyped = /** @type {WW.WorkerGeneric<WW.MsgFromPhysicsWorker, WW.MsgToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const fps = 60;
const timeStepMs = 1000 / fps;
const agentHeight = glbMeta.height * glbMeta.scale;
const agentRadius = glbMeta.radius * glbMeta.scale;

/** @type {Set<string>} A subset of body keys */
const npcKeys = new Set();

/** @type {Map<number, string>} */
const bodyHandleToKey = new Map();
/** @type {Map<string, RAPIER.Collider>} */
const bodyKeyToCollider = new Map();
/** @type {Map<string, RAPIER.RigidBody>} */
const bodyKeyToBody = new Map();

/** @type {RAPIER.World} */
let world;
/** @type {RAPIER.EventQueue} */
let eventQueue;

selfTyped.addEventListener("message", handleMessages);

/** @param {MessageEvent<WW.MsgToPhysicsWorker>} e */
async function handleMessages(e) {
  const msg = e.data;
  info("worker received message", msg);

  switch (msg.type) {
    case "add-npcs":
      for (const npc of msg.npcs) {
        if (npcKeys.has(npc.npcKey) === true) {
          warn(`physics worker: ${msg.type}: cannot re-add body (${npc.npcKey})`)
          continue;
        }
        npcKeys.add(npc.npcKey);
        const body = createRigidBody({
          type: RAPIER.RigidBodyType.KinematicPositionBased,
          halfHeight: agentHeight / 2,
          radius: agentRadius,
          position: { x: npc.position.x, y: agentHeight / 2, z: npc.position.z },
          userData: { npc: true, bodyKey: npc.npcKey },
        });
      }
      break;
    case "remove-npcs":
      // 🔔 no need to remove when not moving (can set asleep)
      for (const npcKey of msg.npcKeys) {
        npcKeys.delete(npcKey);
        const body = bodyKeyToBody.get(npcKey);
        if (body !== undefined) {
          bodyHandleToKey.delete(body.handle);
          bodyKeyToBody.delete(npcKey);
          bodyKeyToCollider.delete(npcKey);
          world.removeRigidBody(body);
        }
      }
    break;
    case "send-npc-positions":
      // 🚧 drives world.tick
      break;
    case "setup-rapier-world": {
      await setupWorld(msg.mapKey);
      selfTyped.postMessage({ type: 'world-is-setup' });
      break;
    }
    default:
      info("physics worker: unhandled:", msg);
      break;
  }
}

function stepWorld() {
  // 🚧 move kinematic bodies
  
  world.step(eventQueue);

  const collisionStart = /** @type {WW.NpcCollisionResponse['collisionStart']} */ ([]);
  const collisionEnd = /** @type {WW.NpcCollisionResponse['collisionEnd']} */ ([]);

  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    const bodyKey1 = /** @type {string} */ (bodyHandleToKey.get(handle1));
    const bodyKey2 = /** @type {string} */ (bodyHandleToKey.get(handle2));
    (started === true ? collisionStart : collisionEnd).push(
      npcKeys.has(bodyKey1) === true
        ? { npcKey: bodyKey1, otherKey: bodyKey2 }
        : { npcKey: bodyKey2, otherKey: bodyKey1 }
    );
  });

  selfTyped.postMessage({
    type: 'npc-collisions',
    collisionStart,
    collisionEnd,
  });
}

/**
 * @param {string} mapKey 
 */
async function setupWorld(mapKey) {

  if (!world) {
    await RAPIER.init();
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.timestep = timeStepMs / 1000;
    eventQueue = new RAPIER.EventQueue(true);
  } else {
    world.forEachRigidBody(rigidBody => world.removeRigidBody(rigidBody));
    world.forEachCollider(collider => world.removeCollider(collider, false));
    bodyKeyToBody.clear();
    bodyKeyToCollider.clear();
    bodyHandleToKey.clear();
    world.bodies.free();
    world.colliders.free();
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
        halfHeight: wallHeight,
        position: { x: center.x, y: wallHeight/2, z: center.y },
        userData: { npc: false, bodyKey: geomorphService.getGmDoorKey(gmId, doorId) },
      })
    )
  );

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
    .setCanSleep(type === RAPIER.RigidBodyType.KinematicPositionBased)
    .setCcdEnabled(false)
  ;

  const colliderDescription = ColliderDesc.cylinder(halfHeight, radius)
    .setDensity(0)
    .setFriction(0)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
    .setRestitution(0)
    .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
    .setSensor(true)
    // .setCollisionGroups(mask)
  ;

  const rigidBody = world.createRigidBody(bodyDescription);
  const collider = world.createCollider(colliderDescription, rigidBody);

  collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  rigidBody.userData = userData;

  bodyKeyToBody.set(userData.bodyKey, rigidBody);
  bodyKeyToCollider.set(userData.bodyKey, collider);
  bodyHandleToKey.set(rigidBody.handle, userData.bodyKey);

  rigidBody.setTranslation(position, false);

  return /** @type {RAPIER.RigidBody & { userData: UserData }} */ (rigidBody);
}
