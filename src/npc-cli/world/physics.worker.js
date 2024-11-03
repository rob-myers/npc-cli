/**
 * Based on: https://github.com/michealparks/sword
 */
import RAPIER, { ColliderDesc, RigidBodyType } from '@dimforge/rapier3d-compat'
import { wallHeight, wallOutset } from '../service/const';
import { info, warn, debug, testNever } from "../service/generic";
import { fetchGeomorphsJson } from '../service/fetch-assets';
import { geomorph } from '../service/geomorph';
import { addBodyKeyUidRelation, npcToBodyKey, parsePhysicsBodyKey } from '../service/rapier';
import { helper } from '../service/helper';
import { tmpRect1 } from '../service/geom';

const selfTyped = /** @type {WW.WorkerGeneric<WW.MsgFromPhysicsWorker, WW.MsgToPhysicsWorker>} */ (
  /** @type {*} */ (self)
);

const config = {
  fps: 60,
  agentHeight: 1.5, // 🚧
  agentRadius: 0.2, // 🚧
};

/** @type {State} */
const state = {
  world: /** @type {*} */ (undefined),
  gms: /** @type {Geomorph.LayoutInstance[]} */ ([]),
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

  if (state.world === undefined && msg.type !== 'setup-physics') {
    return; // Fixes HMR of this file
  }

  // 🔔 avoid logging 60fps messages
  msg.type !== 'send-npc-positions' && debug(
    "🤖 physics.worker received:", msg
  );

  switch (msg.type) {
    case "add-colliders":
      for (const { colliderKey, x, y: z, angle, userData, ...geomDef } of msg.colliders) {
        /** @type {WW.PhysicsBodyKey} */
        const bodyKey = `${geomDef.type} ${colliderKey}`;
  
        if (!(bodyKey in state.bodyKeyToBody)) {
          const _body = createRigidBody({
            type: RAPIER.RigidBodyType.Fixed,
            geomDef,
            // place static collider on floor with height `wallHeight`
            position: { x, y: wallHeight / 2, z },
            angle,
            userData: {
              ...geomDef.type === 'circle'
                ? { type: 'cylinder', radius: geomDef.radius }
                : { type: 'cuboid', width: geomDef.width, depth: geomDef.height, angle: angle ?? 0 },
              bodyKey,
              bodyUid: addBodyKeyUidRelation(bodyKey, state),
              custom: userData,
            },
          });
        } else {
          warn(`🤖 physics.worker: ${msg.type}: cannot re-add body (${bodyKey})`)
        }
      }
      break;
    case "add-npcs":
      for (const npc of msg.npcs) {
        const bodyKey = npcToBodyKey(npc.npcKey);

        if (!(bodyKey in state.bodyKeyToBody)) {
          const _body = createRigidBody({
            type: RAPIER.RigidBodyType.KinematicPositionBased,
            geomDef: {
              type: 'circle',
              radius: config.agentRadius,
            },
            position: { x: npc.position.x, y: config.agentHeight / 2, z: npc.position.z },
            userData: {
              bodyKey,
              bodyUid: addBodyKeyUidRelation(bodyKey, state),
              type: 'npc',
              radius: config.agentRadius,
            },
          });
        } else {
          warn(`physics worker: ${msg.type}: cannot re-add body: ${bodyKey}`)
        }
      }
      break;
    case "get-debug-data":
      sendDebugData();
      break;
    case "remove-bodies":
    case "remove-colliders": {
      const bodyKeys = msg.type === 'remove-bodies'
        ? msg.bodyKeys
        : msg.colliders.map(c => /** @type {const} */ (`${c.type} ${c.colliderKey}`))
      ;
      for (const bodyKey of bodyKeys) {
        const body = state.bodyKeyToBody.get(bodyKey);
        if (body !== undefined) {
          state.bodyHandleToKey.delete(body.handle);
          state.bodyKeyToBody.delete(bodyKey);
          state.bodyKeyToCollider.delete(bodyKey);
          state.world.removeRigidBody(body);
        }
      }
      break;
    }
    case "send-npc-positions": {
      // set kinematic body positions
      let npcBodyKey = /** @type {WW.PhysicsBodyKey} */ ('');
      let position = /** @type {{ x: number; y: number; z: number;  }} */ ({});
      /**
       * ℹ️ decode: [npcBodyUid, positionX, positionY, positionZ, ...]
       */
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
    case "setup-physics":
      await setupOrRebuildWorld(msg.mapKey, msg.npcs);
      selfTyped.postMessage({ type: 'physics-is-setup' });
      break;
    default:
      warn("🤖 physics.worker: unhandled", msg);
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
async function setupOrRebuildWorld(mapKey, npcs) {

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
  state.gms = mapDef.gms.map(({ gmKey, transform }, gmId) =>
    geomorph.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
  );

  createDoorSensors();

  createGmColliders();

  restoreNpcs(npcs);

  // fire initial collisions
  stepWorld();
}

/**
 * - door sensors: nearby, inside
 * - hull door nearby ~ 2x2 grid
 * - non-hull door nearby ~ 1x1 grid
 */
function createDoorSensors() {
  return state.gms.map((gm, gmId) => gm.doors.flatMap((door, doorId) => {
    const center = gm.matrix.transformPoint(door.center.clone());
    const angle = gm.matrix.transformAngle(door.angle);
    const gdKey = helper.getGmDoorKey(gmId, doorId);
    const nearbyKey = /** @type {const} */ (`nearby ${gdKey}`);
    const insideKey = /** @type {const} */ (`inside ${gdKey}`);

    const nearbyDef = {
      width: door.baseRect.width,
      height: door.baseRect.height + 4 * wallOutset,
      // height: door.baseRect.height + 2 * wallOutset,
      angle,
    };
    const insideDef = {
      width: (door.baseRect.width - 2 * wallOutset),
      height: door.baseRect.height,
      angle,
    };

    return [
      // createRigidBody({
      //   type: RAPIER.RigidBodyType.Fixed,
      //   geomDef: {
      //     type: 'circle',
      //     radius: nearbyRadius,
      //   },
      //   position: { x: center.x, y: colliderHeight / 2, z: center.y },
      //   userData: {
      //     bodyKey: nearbyKey,
      //     bodyUid: addBodyKeyUidRelation(nearbyKey, state),
      //     type: 'cylinder',
      //     radius: nearbyRadius,
      //     custom: { hull: door.meta.hull === true },
      //   },
      // }),
      createRigidBody({
        type: RAPIER.RigidBodyType.Fixed,
        geomDef: {
          type: 'rect',
          width: nearbyDef.width,
          height: nearbyDef.height,
        },
        position: { x: center.x, y: wallHeight/2, z: center.y },
        angle,
        userData: {
          bodyKey: nearbyKey,
          bodyUid: addBodyKeyUidRelation(nearbyKey, state),
          type: 'cuboid',
          width: nearbyDef.width,
          depth: nearbyDef.height,
          angle,
        },
      }),
      createRigidBody({
        type: RAPIER.RigidBodyType.Fixed,
        geomDef: {
          type: 'rect',
          width: insideDef.width,
          height: insideDef.height,
        },
        position: { x: center.x, y: wallHeight/2, z: center.y },
        angle,
        userData: {
          bodyKey: insideKey,
          bodyUid: addBodyKeyUidRelation(insideKey, state),
          type: 'cuboid',
          width: insideDef.width,
          depth: insideDef.height,
          angle,
        },
      }),
    ]
  }));
}

/**
 * Supports partial recreation (currently unused)
 * @param {number[]} [gmIds]
 */
function createGmColliders(gmIds = state.gms.map((_, gmId) => gmId)) {
  for (const gmId of gmIds) {
    const gm = state.gms[gmId];
    const decor = gm.decor.filter(
      /** @returns {d is Geomorph.DecorCircle | Geomorph.DecorRect} */ d =>
      d.meta.collider === true && (d.type === 'circle' || d.type === 'rect')
    );

    for (const d of decor) {
      // Transform (instantiate) as in `Decor`
      const bounds2d = tmpRect1.copy(d.bounds2d).applyMatrix(gm.matrix).json;
      const center = gm.matrix.transformPoint({ ...d.center });
      // Key depends on instantiation as in `Decor`
      const decorKey = geomorph.getDerivedDecorKey({ type: d.type, bounds2d, meta: d.meta });
      
      if (d.type === 'circle') {
        /** @type {WW.PhysicsBodyKey} */
        const bodyKey = `circle ${decorKey}`;
        createRigidBody({
          type: RAPIER.RigidBodyType.Fixed,
          geomDef: { type: 'circle', radius: d.radius },
          position: { x: center.x, y: wallHeight/2, z: center.y },
          userData: {
            bodyKey,
            bodyUid: addBodyKeyUidRelation(bodyKey, state),
            type: 'cylinder',
            radius: d.radius,
            custom: {
              gmDecor: true,
              gmId: d.meta.gmId,
            },
          },
        });
      } else if (d.type === 'rect') {
        /** @type {WW.PhysicsBodyKey} */
        const bodyKey = `rect ${decorKey}`;
        createRigidBody({
          type: RAPIER.RigidBodyType.Fixed,
          geomDef: { type: 'rect', width: bounds2d.width, height: bounds2d.height },
          position: { x: center.x, y: wallHeight/2, z: center.y },
          userData: {
            bodyKey,
            bodyUid: addBodyKeyUidRelation(bodyKey, state),
            type: 'cuboid',
            width: bounds2d.width,
            depth: bounds2d.height,
            angle: d.angle,
            custom: {
              gmDecor: true,
              gmId: d.meta.gmId,
            },
          },
          angle: d.angle,
        });
      }
    }

    decor.length && debug(`🤖 physics.worker: gmId ${gmId} decor: created ${decor.length}`);
  }
}

/**
 * On worker HMR we need to restore npcs
 * @param {WW.NpcDef[]} npcs 
 */
function restoreNpcs(npcs) {
  for (const { npcKey, position } of npcs) {
    const bodyKey = npcToBodyKey(npcKey);
    createRigidBody({
      type: RigidBodyType.KinematicPositionBased,
      geomDef: {
        type: 'circle',
        radius: config.agentRadius,
      },
      position,
      userData: {
        bodyKey,
        bodyUid: addBodyKeyUidRelation(bodyKey, state),
        type: 'npc',
        radius: config.agentRadius,
      },
    });
  }
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
 * @param {WW.PhysicsUserData} opts.userData
 */
function createRigidBody({ type, geomDef, position, angle, userData }) {

  const bodyDescription = new RAPIER.RigidBodyDesc(type)
    .setCanSleep(true)
    .setCcdEnabled(false)
  ;

  const colliderDescription = (
    geomDef.type === 'circle'
      ? ColliderDesc.cylinder(wallHeight / 2, geomDef.radius)
      : ColliderDesc.cuboid(geomDef.width / 2, wallHeight / 2, geomDef.height / 2)
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
    rigidBody.setRotation(new RAPIER.Quaternion(0, Math.PI/2 - angle, 0, 1), false);
  }
  rigidBody.setTranslation(position, true);

  return /** @type {RAPIER.RigidBody & { userData: WW.PhysicsUserData }} */ (rigidBody);
}

function sendDebugData() {
  const physicsDebugData = state.world.bodies.getAll().map((x) => ({
    parsedKey: parsePhysicsBodyKey(/** @type {WW.PhysicsUserData} */ (x.userData).bodyKey),
    userData: /** @type {WW.PhysicsUserData} */ (x.userData),
    position: {...x.translation()},
    enabled: x.isEnabled(),
  }));
  // debug({physicsDebugData});
  selfTyped.postMessage({ type: 'debug-data', items: physicsDebugData })
}

if (typeof window === 'undefined') {
  info("🤖 physics.worker started", import.meta.url);
  selfTyped.addEventListener("message", handleMessages);
}

/**
 * @typedef {BaseState & import('../service/rapier').PhysicsBijection} State
 */

/**
 * @typedef BaseState
 * @property {RAPIER.World} world
 * @property {Geomorph.LayoutInstance[]} gms
 * @property {RAPIER.EventQueue} eventQueue
 * @property {Map<number, WW.PhysicsBodyKey>} bodyHandleToKey
 * @property {Map<WW.PhysicsBodyKey, RAPIER.Collider>} bodyKeyToCollider
 * @property {Map<WW.PhysicsBodyKey, RAPIER.RigidBody>} bodyKeyToBody
 */
