import { hashText } from "./generic";

/**
 * Convert physics `bodyKey` into a number i.e. `bodyUid`,
 * for "more efficient" messaging between worker and main thread.
 * 
 * We also record the correspondence in two dictionaries.
 * @param {string} bodyKey e.g. an npcKey or a gmDoorKey
 * @param {PhysicsBijection} lookups 
 * @returns {number}
 */
export function addBodyKeyUidRelation(bodyKey, lookups) {
  const bodyUid = hashText(bodyKey);
  lookups.bodyKeyToUid[bodyKey] = bodyUid;
  lookups.bodyUidToKey[bodyUid] = bodyKey;
  return bodyUid;
}

/**
 * @typedef PhysicsBijection
 * @property {{ [bodyKey: string]: number }} bodyKeyToUid
 * @property {{ [bodyUid: number]: string }} bodyUidToKey
 */
