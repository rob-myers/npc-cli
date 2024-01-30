import React from "react";
import { equals, isPlainObject } from "../service/generic";

/**
 * This hook is a mixture between @see {React.useState} and @see {React.useRef}.
 * - It outputs an object @see {State} which is always the same object, and is designed to be mutated.
 * - Its @see {initializer} returns an object. Typically some of its entries define an API for mutating it.
 * - On HMR it will update these properties "suitably", relative to options.
 * - If the initializer doesn't construct a fresh object, try using
 *   @see {Options.updateFrom}.
 *
 * @template {object} State
 * @param {() => State} initializer Should be side-effect free...
 * @param {Options<State>} [opts]
 */
export default function useStateRef(initializer, opts = {}) {
  const [state] =
    /** @type {[State & { _prevFn?: string; _prevInit?: State; }, any]} */ (
      React.useState(initializer)
    );

  React.useMemo(() => {
    const changed = initializer.toString() !== state._prevFn;

    if (!state._prevFn) {
      /**
       * Initial mount
       */
      // 🚧 avoid invocation in production
      state._prevFn = initializer.toString();
      // state._prevInit = initializer();
      state._prevInit = { ...state };
    } else {
      /**
       * HMR or `opts.deps` has changed.
       * If HMR and `initializer` changed, we may need to update state with new functions, and add/remove keys.
       * If HMR and `initializer` has not changed, the original constructor of the state may have changed elsewhere in codebase.
       * In the case where `initializer` returns a constant value (e.g. spawn npc and look it up subsequently), one can use
       * @see {Options.updateFrom}.
       *
       * Attempt to update state using new initializer:
       * - update all functions
       * - add new properties
       * - remove stale keys
       */
      const newInit = opts.updateFrom ? opts.updateFrom(state) : initializer();

      for (const [k, v] of Object.entries(newInit)) {
        // console.log({ key: k })
        const key = /** @type {keyof State} */ (k);

        if (typeof v === "function") {
          state[key] = v;
        } else if (
          // Also update setters and getters
          // TODO 🚧 had issue with getter?
          Object.getOwnPropertyDescriptor(state, key)?.get ||
          Object.getOwnPropertyDescriptor(state, key)?.set
        ) {
          Object.defineProperty(state, key, {
            get: Object.getOwnPropertyDescriptor(newInit, key)?.get,
            set: Object.getOwnPropertyDescriptor(newInit, key)?.set,
          });
        } else if (!(k in state)) {
          // console.log({ setting: [k, v] })
          state[key] = v;
        } else if (
          state._prevInit &&
          opts.overwrite?.[key] &&
          !equals(state._prevInit[key], newInit[key])
        ) {
          // Update if initial values changed and specified `overwrite`
          state[key] = newInit[key];
        } else if (
          state._prevInit &&
          opts.deeper?.includes(key) &&
          isPlainObject(newInit)
        ) {
          // Sometimes functions and getter/setters are inside a top-level object
          // We could support arbitrary depth, but choose not to
          const innerNewInit = newInit[key];
          const innerState = /** @type {Record<string, any>} */ state[key];
          for (const [innerK, innerV] of Object.entries(
            /** @type {Record<string, any>} */ (innerNewInit)
          )) {
            const innerKey = /** @type {keyof typeof innerState} */ (innerK);
            if (typeof innerV === "function") {
              innerState[innerKey] = innerV;
            } else if (
              // Also update setters and getters
              Object.getOwnPropertyDescriptor(innerState, innerKey)?.get ||
              Object.getOwnPropertyDescriptor(innerState, innerKey)?.set
            ) {
              Object.defineProperty(innerState, innerKey, {
                get: Object.getOwnPropertyDescriptor(innerNewInit, innerKey)
                  ?.get,
                set: Object.getOwnPropertyDescriptor(innerNewInit, innerKey)
                  ?.set,
              });
            }
          }
        }
      }

      for (const k of Object.keys(state)) {
        if (!(k in newInit) && !["_prevFn", "_prevInit"].includes(k)) {
          // console.log({ deleting: k })
          delete state[/** @type {keyof State} */ (k)];
        }
      }

      if (changed) {
        state._prevFn = initializer.toString();
        state._prevInit = newInit;
      }
    }
  }, opts.deps ?? []);

  return /** @type {State} */ (state);
}

module.hot?.decline();

/**
 * @template {Record<string, any>} State
 * @typedef Options
 * @property {import('../service/generic').KeyedTrue<State>} [overwrite]
 * @property {any[]} [deps]
 * @property {(keyof State)[]} [deeper]
 * @property {(current: State) => State} [updateFrom]
 * **DEV ONLY (HMR)**
 *
 * If useStateRef's callback doesn't create a fresh object each time
 * e.g. it may retrieve from a lookup, we can inform the hook how a fresh object would be created,
 * if we weren't preserving identity.
 */
