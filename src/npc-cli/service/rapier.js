import { hashText } from "./generic";

/**
 * Convert physics `bodyKey` into a number i.e. `bodyUid`,
 * for "more efficient" messaging between worker and main thread.
 * 
 * We also record the correspondence in two dictionaries.
 * @param {string} bodyKey e.g. an npcKey or a gmDoorKey
 * @param {{ keyToNum: Record<string, number>; numToKey: Record<number, string>;  }} lookups 
 * @returns {number}
 */
export function addBodyKeyUidRelation(bodyKey, lookups) {
  const bodyUid = hashText(bodyKey);
  lookups.keyToNum[bodyKey] = bodyUid;
  lookups.numToKey[bodyUid] = bodyKey;
  return bodyUid;
}
