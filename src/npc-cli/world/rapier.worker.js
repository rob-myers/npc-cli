/**
 * Based on: https://github.com/michealparks/sword.
 */
import RAPIER from '@dimforge/rapier3d-compat'
import { error, info } from "../service/generic";

info("physics worker started", import.meta.url);

const selfTyped = /** @type {WW.WorkerGeneric<WW.MessageFromPhysicsWorker, WW.MessageToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const fps = 60;
const timeStepMs = 1000 / fps;
/** @type {Map<number, number>} */
const handlemap = new Map()
/** @type {Map<number, boolean>} */
const reportContact = new Map();
/** @type {Map<number, RAPIER.Collider>} */
const collidermap = new Map();

/** @type {RAPIER.World} */
let world;
/** @type {RAPIER.EventQueue} */
let eventQueue;

selfTyped.addEventListener("message", handleMessages);

/** @param {MessageEvent<WW.MessageToPhysicsWorker>} e */
async function handleMessages(e) {
  const msg = e.data;
  info("worker received message", msg);

  switch (msg.type) {
    case "add-npcs":
      // 🚧
      break;
    case "clear-rapier-world":
      if (world) {
        world.forEachCollider(collider => world.removeCollider(collider, false));
        world.forEachRigidBody(rigidBody => world.removeRigidBody(rigidBody));
      }
      break;
    case "remove-npcs":
      // 🚧
      break;
    case "send-npc-positions":
      // 🚧 drives world.tick
      break;
    case "setup-rapier-world": {
      if (!world) {
        await RAPIER.init();
        world = new RAPIER.World({ x: 0, y: 0, z: 0 });
        world.timestep = timeStepMs / 1000;
        eventQueue = new RAPIER.EventQueue(true);
      }
      selfTyped.postMessage({ type: 'world-is-setup' });
      break;
    }
    default:
      info("physics worker: unhandled:", msg);
      break;
  }
}

function stepWorld() {
  world.step(eventQueue);
  
  const collisionStart = /** @type {number[]} */ ([]);
  const collisionEnd = /** @type {number[]} */ ([]);
  const contactStart = /** @type {number[]} */ ([]);

  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    // handlemap.set(rigidBody.handle, id) where id externally identifies body
    const id1 = /** @type {number} */ (handlemap.get(handle1));
    const id2 = /** @type {number} */ (handlemap.get(handle2));

    if (started === true && reportContact.get(id1) === true) {
      // collidermap.set(id, collider)
      const collider1 = /** @type {RAPIER.Collider} */ (collidermap.get(id1));
      const collider2 = /** @type {RAPIER.Collider} */ (collidermap.get(id2));

      world.contactPair(collider1, collider2, (manifold, flipped) => {
        let point1 = manifold.localContactPoint1(0);
        let point2 = manifold.localContactPoint2(0);

        if (point1 !== null && point2 !== null) {
          if (flipped) {
            const temp = point1
            point1 = point2
            point2 = temp
          }

          contactStart.push(
            id1,
            id2,
            point1.x,
            point1.y,
            point1.z,
            point2.x,
            point2.y,
            point2.z
          )
        }
      })
    } else if (started === true) {
      collisionStart.push(id1, id2)
    } else {
      collisionEnd.push(id1, id2)
    }
  });

  const collisionStartArray = new Uint16Array(contactStart);
  const collisionEndArray = new Uint16Array(collisionEnd);
  const contactStartArray = new Float32Array(contactStart);

  selfTyped.postMessage({
    type: 'npc-collisions',
    collisionEnd: collisionEndArray,
    collisionStart: collisionStartArray,
    contactStart: contactStartArray,
  }, [
    collisionEndArray.buffer,
    collisionStartArray.buffer,
    contactStartArray.buffer,
  ]);

}