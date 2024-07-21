/**
 * Based on: https://github.com/michealparks/sword
 */
import RAPIER, { ColliderDesc } from '@dimforge/rapier3d-compat'
import { error, info } from "../service/generic";
import { fetchGeomorphsJson } from '../service/fetch-assets';
import { geomorphService } from '../service/geomorph';
import { glbMeta } from '../service/const';

info("physics worker started", import.meta.url);

const selfTyped = /** @type {WW.WorkerGeneric<WW.MsgFromPhysicsWorker, WW.MsgToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const fps = 60;
const timeStepMs = 1000 / fps;
const agentHalfHeight = (glbMeta.height * glbMeta.scale) * 0.5;
const agentRadius = glbMeta.radius * glbMeta.scale;

const bodies = /** @type {RAPIER.RigidBody[]} */ ([]);
/** @type {Map<number, number>} */
const handlemap = new Map()
/** @type {Map<number, boolean>} */
const reportContact = new Map();
/** @type {Map<number, RAPIER.Collider>} */
const collidermap = new Map();
/** @type {Map<number, RAPIER.RigidBody>} */
const bodymap = new Map();

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
      break;
    case "remove-npcs":
      // 🚧 no need to remove when not moving (can set asleep)
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

  const collisionStart = /** @type {number[]} */ ([]);
  const collisionEnd = /** @type {number[]} */ ([]);
  // const contactStart = /** @type {number[]} */ ([]);

  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    const npcId1 = /** @type {number} */ (handlemap.get(handle1));
    const npcId2 = /** @type {number} */ (handlemap.get(handle2));
    if (started === true) {
      collisionStart.push(npcId1, npcId2)
    } else {
      collisionEnd.push(npcId1, npcId2)
    }
  });

  // const contactStartArray = new Float32Array(contactStart);
  const collisionStartArray = new Uint16Array(collisionStart);
  const collisionEndArray = new Uint16Array(collisionEnd);

  selfTyped.postMessage({
    type: 'npc-collisions',
    // contactStart: contactStartArray,
    collisionStart: collisionStartArray,
    collisionEnd: collisionEndArray,
  }, [
    collisionStartArray.buffer,
    collisionEndArray.buffer,
    // contactStartArray.buffer,
  ]);
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
    bodymap.clear();
    collidermap.clear();
    reportContact.clear();
    world.bodies.free();
    world.colliders.free();
  }

  const geomorphs = geomorphService.deserializeGeomorphs(await fetchGeomorphsJson());
  const mapDef = geomorphs.map[mapKey];
  const gms = mapDef.gms.map(({ gmKey, transform }, gmId) =>
    geomorphService.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
  );
  const doorCenters = gms.map(gm => // indexed by [gmId][doorId]
    gm.doors.map(({ center }) => gm.matrix.transformPoint(center.clone()))
  );
  // 🚧 construct door colliders
    

}

/**
 * @param {number} bodyUid Corresponds to an npc or a door sensor
 */
function createRigidBody(bodyUid) {
  const bodyDescription = new RAPIER.RigidBodyDesc(
    RAPIER.RigidBodyType.KinematicPositionBased
  ).setCanSleep(true).setCcdEnabled(false);

  const colliderDescription = ColliderDesc.cylinder(agentHalfHeight, agentRadius)
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
  reportContact.set(bodyUid, true);

  rigidBody.userData = bodyUid;
  bodymap.set(bodyUid, rigidBody);
  collidermap.set(bodyUid, collider);
  handlemap.set(rigidBody.handle, bodyUid);

  return rigidBody;
}
