/**
 * Evaluate and return a javascript expression
 * @param {RunArg} ctxt 
 */
export function* expr({ api, args }) {
  const input = args.join(" ");
  yield api.parseJsArg(input);
}

/**
 * Filter inputs
 * @param {RunArg} ctxt
 */
export async function* filter(ctxt) {
  let { api, args, datum } = ctxt;
  const func = api.generateSelector(
    api.parseFnOrStr(args[0]),
    args.slice(1).map((x) => api.parseJsArg(x))
  );
  while ((datum = await api.read(true)) !== api.eof)
    if (api.isDataChunk(datum)) yield api.dataChunk(datum.items.filter((x) => func(x, ctxt)));
    else if (func(datum, ctxt)) yield datum;
}

/**
 * Combines map (singleton), filter (empty array) and split (of arrays)
 * @param {RunArg} ctxt
 */
export async function* flatMap(ctxt) {
  let { api, args, datum } = ctxt,
    result; // eslint-disable-next-line no-new-func
  const func = Function(`return ${args[0]}`)();
  while ((datum = await api.read(true)) !== api.eof)
    if (api.isDataChunk(datum)) yield api.dataChunk(datum.items.flatMap((x) => func(x, ctxt)));
    else if (Array.isArray((result = func(datum, ctxt)))) yield* result;
    else yield result;
}

/**
 * Execute a javascript function
 * @param {RunArg} ctxt
 */
export async function* call(ctxt) {
  const func = Function(`return ${ctxt.args[0]}`)();
  ctxt.args = ctxt.args.slice(1);
  yield await func(ctxt);
}

/**
 * Apply function to each item from stdin
 * @param {RunArg} ctxt
 */
export async function* map(ctxt) {
  let { api, args, datum } = ctxt;
  const func = api.generateSelector(
    api.parseFnOrStr(args[0]),
    args.slice(1).map((x) => api.parseJsArg(x))
  );
  while ((datum = await api.read(true)) !== api.eof)
    yield api.isDataChunk(datum)
      ? api.dataChunk(datum.items.map((x) => func(x, ctxt)))
      : func(datum, ctxt);
}

/**
 * @param {RunArg} ctxt 
 */
export async function* poll({ api, args }) {
  yield* api.poll(args);
}

/**
 * Reduce all items from stdin
 * @param {RunArg} ctxt 
 */
export async function* reduce({ api, args, datum }) {
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
}

/**
 * Split arrays from stdin into items.
 * Split strings by optional separator (default `''`).
 * Otherwise ignore.
 * @param {RunArg} ctxt 
 */
export async function* split({ api, args, datum }) {
  const arg = args[0] || "";
  while ((datum = await api.read()) !== api.eof)
    if (datum instanceof Array) {
      // yield* datum
      yield api.dataChunk(datum);
    } else if (typeof datum === "string") {
      // yield* datum.split(arg)
      yield api.dataChunk(datum.split(arg));
    }
}

/**
 * Collect stdin into a single array
 * @param {RunArg} ctxt 
 */
export async function* sponge({ api, datum }) {
  const outputs = [];
  while ((datum = await api.read(true)) !== api.eof)
    if (api.isDataChunk(datum)) {
      // Spread throws: Maximum call stack size exceeded
      datum.items.forEach((item) => outputs.push(item));
    } else {
      outputs.push(datum);
    }
  yield outputs;
}

/**
 * Usage
 * - `poll 1 | while x=$( take 1 ); do echo ${x} ${x}; done`
 * @param {RunArg} ctxt 
 */
export async function* take({ api, args, datum }) {
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
}

/**
 * @typedef RunArg
 * @property {import('../cmd.service').CmdService['processApi'] & {
 *   getCached(key: '__WORLD_KEY_VALUE__'): import('../../world/TestWorld').State;
 * }} api
 * @property {string[]} args
 * @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
 * @property {*} [datum] A shortcut for declaring a variable
 */
