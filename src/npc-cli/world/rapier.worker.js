/**
 * Based on: https://github.com/michealparks/sword
 */
import RAPIER, { ColliderDesc } from '@dimforge/rapier3d-compat'
import { glbMeta, wallHeight } from '../service/const';
import { error, info } from "../service/generic";
import { fetchGeomorphsJson } from '../service/fetch-assets';
import { geomorphService } from '../service/geomorph';

info("physics worker started", import.meta.url);

const selfTyped = /** @type {WW.WorkerGeneric<WW.MsgFromPhysicsWorker, WW.MsgToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const fps = 60;
const timeStepMs = 1000 / fps;
const agentHalfHeight = (glbMeta.height * glbMeta.scale) * 0.5;
const agentRadius = glbMeta.radius * glbMeta.scale;

/** @type {Set<string>} A subset of body keys */
const npcKeys = new Set();

const bodies = /** @type {RAPIER.RigidBody[]} */ ([]);
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
      // 🚧
      msg.npcKeys.forEach(npcKey => npcKeys.add(npcKey));
      break;
    case "remove-npcs":
      // 🚧 no need to remove when not moving (can set asleep)
      msg.npcKeys.forEach(npcKey => npcKeys.delete(npcKey));
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
    world.forEachCollider(collider => world.removeCollider(collider, false));
    world.forEachRigidBody(rigidBody => world.removeRigidBody(rigidBody));
    bodies.length = 0;
    bodyKeyToBody.clear();
    bodyKeyToCollider.clear();
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
        bodyKey: geomorphService.getGmDoorKey(gmId, doorId),
        type: RAPIER.RigidBodyType.Fixed,
        radius: 1.5, // meters
        halfHeight: wallHeight,
        position: { x: center.x, y: wallHeight/2, z: center.y },
      })
    )
  );

}

/**
 * @param {object} opts
 * @param {string} opts.bodyKey e.g. npcKey or gmDoorId
 * @param {RAPIER.RigidBodyType.Fixed | RAPIER.RigidBodyType.KinematicPositionBased} opts.type
 * @param {number} opts.halfHeight
 * @param {number} opts.radius
 * @param {import('three').Vector3Like} opts.position
 */
function createRigidBody({ bodyKey, type, halfHeight, radius, position }) {

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

  rigidBody.userData = { npc: npcKeys.has(bodyKey), bodyKey };
  bodyKeyToBody.set(bodyKey, rigidBody);
  bodyKeyToCollider.set(bodyKey, collider);
  bodyHandleToKey.set(rigidBody.handle, bodyKey);

  rigidBody.setTranslation(position, false);

  return rigidBody;
}
