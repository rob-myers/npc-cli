
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
 * @typedef RunArg
 * @property {import('./cmd.service').CmdService['processApi'] & {
 *   getCached(key: '__WORLD_KEY_VALUE__'): import('../aux/TestWorld').State;
 * }} api
 * @property {string[]} args
 * @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
 * @property {*} [datum] A shortcut for declaring a variable
 */
