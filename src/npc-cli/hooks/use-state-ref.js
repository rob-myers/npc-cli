import React from "react";

/**
 * This hook is a mixture of `React.useState` and `React.useRef`.
 * - It outputs an object of type `State` which:
 *   - is always the same object.
 *   - is typically a dictionary of functions and values.
 *   - is designed to be mutated by these functions.
 * - Its `initializer` is a parameterless function constructing this object.
 * - On HMR it will update these properties "suitably", relative to options.
 *
 * @template {Record<string, any>} State
 * @param {() => State} initializer Should be side-effect free.
 * @param {Options<State>} [opts]
 */
export default function useStateRef(initializer, opts = {}) {
  const [state] = /** @type {[State & { _prevFn?: string }, any]} */ (
    React.useState(initializer)
  );

  React.useMemo(() => {
    const changed = initializer.toString() !== state._prevFn;

    if (!state._prevFn) {
      /**
       * Initial mount
       * 🚧 avoid invocation in production
       */
      state._prevFn = initializer.toString();
    } else {
      /**
       * Either HMR or `opts.deps` has changed.
       * If HMR and `initializer` changed, we may need to update state with new functions, and add/remove keys.
       * If HMR and `initializer` has not changed, the original constructor of the state may have changed elsewhere in codebase.
       *
       * Attempt to update state using new initializer:
       * - update all functions
       * - add new properties
       * - remove stale keys
       */
      const newInit = initializer();

      for (const [k, v] of Object.entries(newInit)) {
        // console.log({ key: k })
        const key = /** @type {keyof State} */ (k);

        // ℹ️ we don't support getters or setters
        if (typeof v === "function") {
          state[key] = v;
        } else if (!(k in state)) {
          // console.log({ setting: [k, v] })
          state[key] = v;
        } else if (opts.overwrite?.[key]) {
          // Update if initial values changed and specified `overwrite`
          state[key] = newInit[key];
        }
      }

      for (const k of Object.keys(state)) {
        if (!(k in newInit) && k !== "_prevFn") {
          // console.log({ deleting: k })
          delete state[/** @type {keyof State} */ (k)];
        }
      }

      if (changed) {
        state._prevFn = initializer.toString();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, opts.deps ?? []);

  return /** @type {State} */ (state);
}

module.hot?.decline();

/**
 * @template {Record<string, any>} State
 * @typedef Options
 * @property {import('../service/generic').KeyedTrue<State>} [overwrite]
 * Reset field on HMR?
 * @property {any[]} [deps]
 */
