/* eslint-disable no-undef, no-useless-escape, require-yield, @typescript-eslint/ban-ts-comment */
/**
 * This file is loaded via webpack `raw-loader` to avoid function transpilation.
 * 🔔🔔🔔🔔 We MUST avoid single-quotes ANYWHERE inside function bodies 🔔🔔🔔🔔
 *
 * `utilFunctions` is provided by the context
 * > We'll extend it using @see utilFunctionsRunDefs
 * > They are both arrays in order to support future versions of the named functions.
 *
 * `gameFunctions` is provided by the context
 * > We'll extend it using @see gameFunctionsRunDefs
 */

//#region defs

/**
 * @typedef RunArg
 * @property {import('./cmd.service').CmdService['processApi']} api
 * 🚧 add back in
 * //@property {import('./cmd.service').CmdService['processApi'] & {
 *   getCached(key: '__WORLD_KEY_VALUE__'): import('../world/World').State;
 * }} api
 * @property {string[]} args
 * @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
 * @property {*} [datum] A shortcut for declaring a variable
 */

/**
 * Util shell functions which invoke a single builtin: `run`.
 *
 * In particular,
 * > `foo: async function* (...) {...}`
 *
 * becomes:
 * > `foo() { run '(...) {...}' "$@"; }`
 *
 * @type {Record<string, (arg: RunArg) => void>[]}
 */
const utilFunctionsRunDefs = [
  {
    /** Evaluate and return a javascript expression */
    expr: function* ({ api, args }) {
      const input = args.join(" ");
      yield api.parseJsArg(input);
    },

    /** Filter inputs */
    filter: async function* (ctxt) {
      let { api, args, datum } = ctxt;
      const func = api.generateSelector(
        api.parseFnOrStr(args[0]),
        args.slice(1).map((x) => api.parseJsArg(x))
      );
      while ((datum = await api.read(true)) !== api.eof)
        if (api.isDataChunk(datum)) yield api.dataChunk(datum.items.filter((x) => func(x, ctxt)));
        else if (func(datum, ctxt)) yield datum;
    },

    /** Combines map (singleton), filter (empty array) and split (of arrays) */
    flatMap: async function* (ctxt) {
      let { api, args, datum } = ctxt,
        result; // eslint-disable-next-line no-new-func
      const func = Function(`return ${args[0]}`)();
      while ((datum = await api.read(true)) !== api.eof)
        if (api.isDataChunk(datum)) yield api.dataChunk(datum.items.flatMap((x) => func(x, ctxt)));
        else if (Array.isArray((result = func(datum, ctxt)))) yield* result;
        else yield result;
    },

    /** Execute a javascript function */
    call: async function* (ctxt) {// eslint-disable-next-line no-new-func
      const func = Function(`return ${ctxt.args[0]}`)();
      ctxt.args = ctxt.args.slice(1);
      yield await func(ctxt);
    },

    /** Apply function to each item from stdin */
    map: async function* (ctxt) {
      let { api, args, datum } = ctxt;
      const func = api.generateSelector(
        api.parseFnOrStr(args[0]),
        args.slice(1).map((x) => api.parseJsArg(x))
      );
      while ((datum = await api.read(true)) !== api.eof)
        yield api.isDataChunk(datum)
          ? api.dataChunk(datum.items.map((x) => func(x, ctxt)))
          : func(datum, ctxt);
    },

    poll: async function* ({ api, args }) {
      yield* api.poll(args);
    },

    /** Reduce all items from stdin */
    reduce: async function* ({ api, args, datum }) {
      const inputs = []; // eslint-disable-next-line no-new-func
      const reducer = Function(`return ${args[0]}`)();
      while ((datum = await api.read(true)) !== api.eof)
        // Spread throws: Maximum call stack size exceeded
        if (api.isDataChunk(datum)) {
          datum.items.forEach((item) => inputs.push(item));
        } else {
          inputs.push(datum);
        }
      yield args[1] ? inputs.reduce(reducer, api.parseJsArg(args[1])) : inputs.reduce(reducer);
    },

    /**
     * Split arrays from stdin into items.
     * Split strings by optional separator (default `''`).
     * Otherwise ignore.
     */
    split: async function* ({ api, args, datum }) {
      const arg = args[0] || "";
      while ((datum = await api.read()) !== api.eof)
        if (datum instanceof Array) {
          // yield* datum
          yield api.dataChunk(datum);
        } else if (typeof datum === "string") {
          // yield* datum.split(arg)
          yield api.dataChunk(datum.split(arg));
        }
    },

    /** Collect stdin into a single array */
    sponge: async function* ({ api, datum }) {
      const outputs = [];
      while ((datum = await api.read(true)) !== api.eof)
        if (api.isDataChunk(datum)) {
          // Spread throws: Maximum call stack size exceeded
          datum.items.forEach((item) => outputs.push(item));
        } else {
          outputs.push(datum);
        }
      yield outputs;
    },

    take: async function* ({ api, args, datum }) {
      try {
        let remainder = Number(args[0] || Number.POSITIVE_INFINITY);
        while (remainder-- > 0 && (datum = await api.read(true)) !== api.eof) {
          if (api.isDataChunk(datum)) {
            const items = datum.items.slice(0, remainder + 1);
            remainder -= items.length - 1;
            yield api.dataChunk(items);
          } else {
            yield datum;
          }
        }
      } catch (e) {
        throw e ?? api.getKillError();
      }
    },
  },
];

/**
 * Game shell functions which invoke a single builtin: `run`.
 *
 * In particular,
 * > `foo: async function* (...) {...}`
 *
 * becomes:
 * > `foo() { run '(...) {...}' "$@"; }`
 *
 * @type {Record<string, (arg: RunArg) => void>[]}
 */
const gameFunctionsRunDefs = [
  // 🚧 add back in
];

//#endregion

/**
 * Convert functions into shell function bodies
 */
utilFunctionsRunDefs.forEach((defs, i) =>
  Object.entries(defs).forEach(
    // @ts-expect-error
    ([key, fn]) => ((utilFunctions[i] = utilFunctions[i] || [])[key] = wrap(fn))
  )
);
gameFunctionsRunDefs.forEach((defs, i) =>
  Object.entries(defs).forEach(
    // @ts-expect-error
    ([key, fn]) => ((gameFunctions[i] = gameFunctions[i] || [])[key] = wrap(fn))
  )
);

/** @param {(arg: { api: any; args: string[]; }) => any} fn */
function wrap(fn) {
  return `{
      run '${fnToSuffix(fn)}' "$@"
}`;
}

/**
 * We assume the input is an anonymous function.
 * @param {(arg: { api: any; args: string[]; }) => any} fn
 */
function fnToSuffix(fn) {
  switch (fn.constructor.name) {
    case "GeneratorFunction":
      return `${fn}`.slice("function* ".length);
    case "AsyncGeneratorFunction":
      return `${fn}`.slice("async function* ".length);
    default:
      return `${fn}`.slice("function ".length);
  }
}
