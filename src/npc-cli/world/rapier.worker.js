import RAPIER from '@dimforge/rapier3d-compat'
import { error, info } from "../service/generic";

info("physics worker started", import.meta.url);

const selfTyped = /** @type {WW.WorkerGeneric<WW.MessageFromPhysicsWorker, WW.MessageToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const fps = 60;
const timeStepMs = 1000 / fps;
/** @type {RAPIER.World} */
let world;

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
        world = new RAPIER.World({ x: 0, y: 0, z: 0 })
        world.timestep = timeStepMs / 1000;
      }
      selfTyped.postMessage({ type: 'world-is-setup' });
      break;
    }
    default:
      info("physics worker: unhandled:", msg);
      break;
  }
}

