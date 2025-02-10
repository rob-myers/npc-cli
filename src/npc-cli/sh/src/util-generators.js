/**
 * Execute a javascript function, e.g.
 * ```sh
 * call "() => 42"
 * call "({ home }) => home.foo"
 * call '({ args }) => `Hello, ${args[0]}`' Rob
 * ```
 * @param {RunArg} ctxt
 */
export async function* call(ctxt) {
  const func = Function(`return ${ctxt.args[0]}`)();
  ctxt.args = ctxt.args.slice(1);
  yield await func(ctxt);
}

/**
 * Evaluate and return a javascript expression
 * ```sh
 * expr 2 ** 10
 * expr window.navigator.vendor
 * expr '((x) => [x, x, x])("a lady")'
 * ```
 * @param {RunArg} ctxt 
 */
export function* expr({ api, args }) {
  const input = args.join(" ");
  yield api.parseJsArg(input);
}

/**
 * Filter inputs
 * ```sh
 * seq 10 | filter 'x => !(x % 2)'
 * expr window | keysAll | split | filter /^n/
 * ```
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
 * ```sh
 * seq 10 | flatMap 'x => [...Array(x)].map((_, i) => i)'
 * { range 10; range 20; } | flatMap 'x => x'
 * ```
 * - ℹ️ supports chunks
 * @param {RunArg} ctxt
 */
export async function* flatMap(ctxt) {
  let { api, args, datum } = ctxt;
  let result;
  const func = Function(`return ${args[0]}`)();
  while ((datum = await api.read(true)) !== api.eof) {
    if (api.isDataChunk(datum)) yield api.dataChunk(datum.items.flatMap((x) => func(x, ctxt)));
    else if (Array.isArray((result = func(datum, ctxt)))) yield* result;
    else yield result;
  }
}

/**
 * ```sh
 * # initially logs args, then stdin.
 * log $foo bar
 * seq 10 | log
 * ```
 * - ℹ️ `map console.log` would log 2nd arg too
 * - ℹ️ logs chunks larger than 1000, so e.g. `seq 1000000 | log` works
 * @param {RunArg} ctxt 
 * @returns 
 */
export async function* log({ api, args, datum }) {
  args.forEach(arg => console.log(arg))
  if (api.isTtyAt(0)) return
  while ((datum = await api.read(true)) !== api.eof) {
    if (api.isDataChunk(datum) && datum.items.length <= 1000) {
      datum.items.forEach(x => console.log(x));
    } else {
      console.log(datum);
    }
  }
}

/**
 * Apply function to each item from stdin.
 * ```sh
 * seq 10 | map 'x => 2 ** x'
 * echo foo | map Array.from
 * expr window | map navigator.connection | log
 * ```
 * - ℹ️ To use `await`, the provided function must begin with `async`.
 * @param {RunArg} ctxt
 */
export async function* map(ctxt) {
  let { api, args, datum } = ctxt;
  const { operands, opts } = api.getOpts(args, { boolean: ["forever"] });

  const baseSelector = api.parseFnOrStr(operands[0]);
  const func = typeof baseSelector === "string"
    // e.g. expr "{ foo: { inc: (x) => x+1  }  }" | map foo.inc 3
    ? api.generateSelector(baseSelector, operands.slice(1).map(api.parseJsArg))
    // e.g. echo | map "(x, {args}) => args[1]" foo
    : api.generateSelector(baseSelector)
  ;
  // fix e.g. `expr "new Set([1, 2, 3])" | map Array.from`
  const isNativeCode = /\{\s*\[\s*native code\s*\]\s*\}$/m.test(`${baseSelector}`);
  const isAsync = func.constructor.name === "AsyncFunction";
  let count = 0;

  if (isNativeCode === false) {

    while ((datum = await api.read(true)) !== api.eof) {
      try {
        if (api.isDataChunk(datum) === true) {
          if (isAsync === false) {// fast on chunks:
            yield api.dataChunk(datum.items.map(x => func(x, ctxt, count++)));
          } else {// unwind chunks:
            for (const item of datum.items) yield await func(item, ctxt, count++);
          }
        } else {
          yield await func(datum, ctxt, count++);
        }
      } catch (e) {
        if (opts.forever === true) {
          api.error(`${api.meta.stack.join(": ")}: ${e instanceof Error ? e.message : e}`);
          continue;
        }
        throw e;
      }
    }

  } else {

    while ((datum = await api.read()) !== api.eof) {
      try {
        yield await func(datum);
      } catch (e) {
        if (opts.forever === true) {
          api.error(`${api.meta.stack.join(": ")}: ${e instanceof Error ? e.message : e}`);
          continue;
        }
        throw e;
      }
    }

  }

  while ((datum = await api.read(true)) !== api.eof) {
    try {
      if (api.isDataChunk(datum) === true) {
        if (isAsync === true) {// unwind chunks:
          for (const item of datum.items) {
            yield await (isNativeCode ? func(item) : func(item, ctxt, count++));
          }
        } else {// fast on chunks:
          yield api.dataChunk(datum.items.map(isNativeCode ? func : x => func(x, ctxt, count++)));
        }
      } else {
        yield await (isNativeCode ? func(datum) : func(datum, ctxt, count++));
      }
    } catch (e) {
      if (opts.forever === true) {
        api.error(`${api.meta.stack.join(": ")}: ${e instanceof Error ? e.message : e}`);
      } else {
        throw e;
      }
    }
  }
}

/**
 * Apply native or one-arg-function to each item from stdin.
 * ```sh
 * echo foo | mapBasic Array.from
 * ```
 * - ℹ️ We do not support chunks.
 * - ℹ️ To use `await`, the one-arg-function must begin with `async`.
 * @param {RunArg} ctxt
 */
export async function* mapBasic(ctxt) {
  let { api, args, datum } = ctxt;
  const { operands, opts } = api.getOpts(args, { boolean: ["forever"] });
  // e.g. "Array.from", "x => [x, x]"
  const func = Function(`return ${operands[0]}`)();

  while ((datum = await api.read()) !== api.eof) {
    try {
      yield await func(datum);
    } catch (e) {
      if (opts.forever === true) {
        api.error(`${api.meta.stack.join(": ")}: ${e instanceof Error ? e.message : e}`);
      } else {
        throw e;
      }
    }
  }
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
 * Split strings by optional separator (default `''`), e.g.
 * - `split ,` splits by comma
 * - `split '/\n/'` splits by newlines
 * @param {RunArg} ctxt 
 */
export async function* split({ api, args, datum }) {
  let arg = api.parseJsArg( args[0] || "");
  while ((datum = await api.read()) !== api.eof)
    if (datum instanceof Array) {
      // yield* datum
      yield api.dataChunk(datum);
    } else if (typeof datum === "string") {
      // yield* datum.split(arg)
      yield api.dataChunk(datum.split(arg));
    } else if (datum instanceof Set) {
      yield api.dataChunk(Array.from(datum));
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
    // 🔔 cannot support chunks if want pattern:
    // seq 5 | while take 1 >foo; do foo; done
    while (remainder-- > 0 && (datum = await api.read(false)) !== api.eof) {
      yield datum;
    }
    if (remainder >= 0) {
      throw api.getShError("", 1);
    }
  } catch (e) {
    throw e ?? api.getKillError();
  }
}

/**
 * @typedef RunArg
 * @property {import('../cmd.service').CmdService['processApi']} api
 * @property {string[]} args
 * @property {{ [key: string]: any }} home
 * @property {*} [datum] A shortcut for declaring a variable
 */
