import prettyCompact from "json-stringify-pretty-compact";
import safeStableStringify from "safe-stable-stringify";

/**
 * @template {{ key: string }} LookupItem
 * @param {LookupItem} newItem
 * @param {KeyedLookup<LookupItem>} lookup
 * @returns {KeyedLookup<LookupItem>}
 */
export function addToLookup(newItem, lookup) {
  return { ...lookup, [newItem.key]: newItem };
}

/**
 * JSDoc types lack a non-null assertion.
 * https://github.com/Microsoft/TypeScript/issues/23405#issuecomment-873331031
 *
 * Throws if the supplied value is _undefined_ (_null_ is allowed).\
 * Returns (via casting) the supplied value as a T with _undefined_ removed from its type space.
 * This informs the compiler that the value cannot be _undefined_.
 * @template T
 * @param {T} value
 * @param {string} [valueName]
 * @returns {T extends undefined ? never : T}
 */
export function assertDefined(value, valueName) {
  if (value === undefined) {
    throw new Error(
      `Encountered unexpected undefined value${valueName ? ` for '${valueName}'` : ""}`
    );
  }
  return /** @type {*} */ (value);
}

/**
 * JSDoc types lack a non-null-or-undefined assertion.
 * https://github.com/Microsoft/TypeScript/issues/23405#issuecomment-873331031
 * @template T
 * @param {T} value
 * @returns {T extends undefined | null ? never : T}
 */
export function assertNonNull(value, ensureNull = true) {
  if (ensureNull && value == null) {
    throw new Error(`Encountered unexpected null or undefined value`);
  }
  return /** @type {*} */ (value);
}

/**
 * @template T
 * @param {T[]} items
 * @param {(x: T, y: T) => boolean} related
 * @returns {T[][]}
 */
export function computeCliques(items, related) {
  return items.reduce((agg, item) => {
    for (const clique of agg) {
      if (clique.some((x) => related(item, x))) {
        clique.push(item);
        return agg;
      }
    }
    agg.push([item]); // New clique
    return agg;
  }, /** @type {T[][]} */ ([[]]));
}

/**
 *
 * @param {any} obj
 * @param {string[]} path
 * @returns
 */
export function deepGet(obj, path) {
  return path.reduce((agg, part) => agg[part], obj);
}

/**
 * Iterate deep keys separated by `/`.
 * https://stackoverflow.com/a/65571163/2917822
 * @param {any} t
 * @param {string[]} path
 * @returns {IterableIterator<string>}
 */
function* deepKeys(t, path = []) {
  switch (t?.constructor) {
    case Object:
      for (const [k, v] of Object.entries(t)) yield* deepKeys(v, [...path, k]);
      break;
    default:
      yield path.join("/");
  }
}

/**
 * @template T
 */
export class Deferred {
  /** @type {(value: T | PromiseLike<T>) => void} */
  resolve = () => {};
  /** @type {(reason?: any) => void} */
  reject = () => {};
  /** @type {Promise<T>} */
  promise = new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

/**
 * Test equality, i.e. test fn `equality`,
 * falling back to primitive equality,
 * and recurse on arrays/objects.
 * @param {*} x
 * @param {*} y
 * @returns {boolean}
 */
export function equals(x, y, depth = 0) {
  if (depth > 10) {
    throw Error("equals: recursive depth exceeded 10");
  }
  if (x !== undefined && y === undefined) {
    return false;
  } else if (typeof x?.equals === "function") {
    return x.equals(y) === true;
  } else if (Array.isArray(x)) {
    return x.every((u, i) => equals(u, y[i]), depth + 1) && x.length === y.length;
  } else if (isPlainObject(x)) {
    return (
      Object.keys(x).every((key) => equals(x[key], y[key]), depth + 1) &&
      Object.keys(x).length === Object.keys(y).length
    );
  } else {
    return x === y;
  }
}

/**
 * https://stackoverflow.com/a/15710692/2917822
 * @param {string} s
 */
export function hashText(s) {
  return s.split("").reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
}

/**
 * https://github.com/sindresorhus/is-plain-obj/blob/main/index.js
 * @param {*} value
 * @returns
 */
export function isPlainObject(value) {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/**
 * @template T
 * @param {(T | T[])[]} items
 */
export function flatten(items) {
  return /** @type {T[]} */ ([]).concat(...items);
}

/**
 * @template T
 * @param {T[]} items
 * @returns {T | undefined}
 */
export function last(items) {
  return items[items.length - 1];
}

/**
 * Remove the _first_ occurrence of `elem` from _`array`_,
 * **mutating** the latter if the former exists.
 * @template T
 * @param {T[]} array
 * @param {T} elem
 */
export function removeFirst(array, elem) {
  const firstIndex = array.indexOf(elem);
  if (firstIndex !== -1) {
    array.splice(firstIndex, 1);
  }
  return array;
}

/**
 * Clone serializable data `input`, e.g. not regexes.
 * @template T
 * @param {T} input
 * @returns {T}
 */
export function deepClone(input) {
  return JSON.parse(JSON.stringify(input));
}

/**
 * Convert a function, regexp or string into a 'selector'.
 * - for functions we merely prefix args extraArgs
 * - for strings we support e.g.
 *   - `foo.bar.baz` -> function (x) { return x.foo.bar.baz }
 *   - `foo.bar.baz` -> function (x) { return x.foo.bar.baz() }
 *   - `foo.bar baz qux` -> function (x) { return x.foo.bar(baz, qux) }
 *
 * Technically the latter selectors are dependent on the particular value of `x`.
 * But in practice we can often expect them to act uniformly like the examples above.
 * @param {((x: any) => any) | string | RegExp} selector
 * @param {any[]} [extraArgs]
 * @returns {(x: any, ...xs: any[]) => any}
 */
export function generateSelector(selector, extraArgs) {
  if (typeof selector === "string") {
    /** @param {any} x @param {any[]} xs */
    return function selectByStr(x, ...xs) {
      const selected = /** @type {string} */ (selector).split(".").reduce(
        (agg, part) => (x = agg)[part], // x is parent of possible function
        /** @type {*} */ (x)
      ); // If we selected a function, invoke it
      return typeof selected === "function"
        ? // ℹ️ Forwarding ...xs can break invocation
          selected.call(x, ...(extraArgs ?? []))
        : selected;
    };
  }
  if (typeof selector === "function") {
    /** @param {any} x @param {any[]} xs */
    return function selectByFn(x, ...xs) {
      return /** @type {(...args: any[]) => any} */ (selector)(x, ...(extraArgs ?? []), ...xs);
    };
  }
  if (selector instanceof RegExp) {
    /** @param {string} x @param {any[]} xs */
    return function selectByRegexp(x, ...xs) {
      // 🚧 support extraArgs e.g. extract via '$2 $1'
      return selector.test.call(selector, typeof x === "string" ? x : JSON.stringify(x));
    };
  }
  if (selector === undefined) {
    return (x) => x;
  }
  throw Error(`selector ${selector} should be a function, regexp or string`);
}

/**
 * @template {string | number} K
 * @param {Partial<Record<K, any>> | Record<K, any>} record
 * Typed `Object.keys`, usually as finitely many string literals.
 */
export function keys(record) {
  return /** @type {K[]} */ (Object.keys(record));
}

/**
 * @param {any} obj
 * @returns {string[]}
 */
export function keysDeep(obj) {
  return Array.from(deepKeys(obj));
}

/**
 * @template SrcValue
 * @template DstValue
 * @template {string | number} Key
 * @param {Record<Key, SrcValue>} input
 * @param {(value: SrcValue, key: Key) => DstValue} transform
 * Given `{ [key]: value }`, returns fresh
 * `{ [key]: _transform_(value) }`.
 */
export function mapValues(input, transform) {
  const output = /** @type {Record<Key, DstValue>} */ ({});
  keys(input).forEach((key) => (output[key] = transform(input[key], key)));
  return output;
}

/**
 * Parse input with string fallback
 * - preserves `undefined`
 * - preserves empty-string
 * @param {string} [input]
 */
export function parseJsArg(input) {
  try {
    if (input === "") return input;
    // eslint-disable-next-line no-new-func
    return Function(`return ${input}`)();
  } catch (e) {
    return input;
  }
}

/**
 * JSON.parse with string fallback
 * @param {string} input
 */
export function parseJsonArg(input) {
  try {
    return input === undefined ? undefined : JSON.parse(input);
  } catch {
    return input;
  }
}

/** @returns {Promise<void>} */
export function pause(ms = 0) {
  return new Promise((r) => setTimeout(() => r(), ms));
}

/**
 * @param {number} number
 * @param {number} [decimalPlaces] default 2
 */
export function precision(number, decimalPlaces = 2) {
  return Number(number.toFixed(decimalPlaces));
}

/**
 * Pretty-print JSON.
 * @param {any} input
 * @returns {string}
 */
export function pretty(input) {
  // return JSON.stringify(input, null, '\t');
  return prettyCompact(input);
}

/**
 * @template T
 * @param {T[]} items
 */
export function removeDups(items) {
  return Array.from(new Set(items));
}

/**
 * @template {{ key: string }} LookupItem
 * @param {string} itemKey
 * @param {KeyedLookup<LookupItem>} lookup
 * @returns {KeyedLookup<LookupItem>}
 */
export function removeFromLookup(itemKey, lookup) {
  const { [itemKey]: _, ...rest } = lookup;
  return rest;
}

/** @param {string} input */
export function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch {
    console.warn(`failed to JSON.parse: "${input}"`);
    return undefined;
  }
}

/** @param {any} input */
export function safeStringify(input) {
  if (typeof input === "function") {
    return zealousTrim(`${input}`);
  }
  return (
    tryJsonStringify(input) ||
    safeStableStringify(input, (_k, v) => {
      if (v instanceof HTMLElement || v instanceof Animation) return `'[${v.constructor.name}]'`;
      if (typeof v === "function") return zealousTrim(`${v}`);
      // if (v instanceof EventEmitter) {
      //   // Fix pixi.js
      //   return `'[${v.constructor?.name ?? "EventEmitter"}]'`;
      // }
      return v;
    })
  );
}

/**
 * Usage `default: throw testNever(x)`.
 * @param {never} x
 * @param {{ override?: string; suffix?: string }} [opts]
 * @returns {string}
 */
export function testNever(x, opts) {
  return (
    opts?.override ??
    `testNever: ${pretty(x)} not implemented${opts?.suffix ? ` (${opts.suffix})` : ""}`
  );
}

/**
 * @param {string} text
 * @returns
 */
export function truncateOneLine(text, maxLength = 50) {
  text = text.trimStart();
  const isLong = text.length > maxLength;
  return isLong ? `${text.split("\n", 1)[0].slice(0, maxLength)} ...` : text;
}

/** @param {any} input */
function tryJsonStringify(input) {
  try {
    let ownKeys = /** @type {string[]} */ ([]);
    return JSON.stringify(input, (_k, v) => {
      if (typeof v === "function") {
        return `[Function]${(ownKeys = Object.keys(v)).length ? ` ...{${ownKeys}} ` : ""}`;
      }
      return v;
    });
  } catch {}
}

/**
 * @template {string} T
 * @param {string} key
 * @returns {T | null}
 */
export function tryLocalStorageGet(key, logErr = false) {
  try {
    return /** @type {T} */ (localStorage.getItem(key));
  } catch (e) {
    logErr && console.error(e);
    return null;
  }
}

/**
 * @param {string} key
 */
export function tryLocalStorageRemove(key, logErr = true) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    logErr && console.error(e);
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
export function tryLocalStorageSet(key, value, logErr = true) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    logErr && console.error(e);
  }
}

/** @param {string} input */
function zealousTrim(input) {
  return input.trim().replace(/\s\s+/g, " ").trim();
}

/**
 * Source:
 * - https://stackoverflow.com/a/51396686/2917822
 * - https://blog.jonnew.com/posts/poo-dot-length-equals-two
 *
 * Apparently won't work for all unicode characters,
 * but perhaps we can restrict them.
 * @param {string} input
 */
export function visibleUnicodeLength(input) {
  const split = input.split("\u{200D}");
  return (
    split.reduce(
      (sum, item) => sum + Array.from(item.split(/[\ufe00-\ufe0f]/).join("")).length,
      0
    ) / split.length
  );
}

//#region logging

/** https://stackoverflow.com/a/26078207/2917822 */
export const debug = (function () {
  return Function.prototype.bind.call(console.debug, console, "\x1b[34mDEBUG\x1b[0m");
})();

/** https://stackoverflow.com/a/26078207/2917822 */
export const error = (function () {
  return Function.prototype.bind.call(console.error, console, "\x1b[31mERROR\x1b[0m");
})();

/** https://stackoverflow.com/a/26078207/2917822 */
export const info = (function () {
  return Function.prototype.bind.call(console.info, console, "\x1b[34mINFO\x1b[0m");
})();

/** https://stackoverflow.com/a/26078207/2917822 */
export const warn = (function () {
  return Function.prototype.bind.call(console.warn, console, "\x1b[33mWARN\x1b[0m");
})();

//#endregion

/**
 * @template {{ key: K}} Value
 * @template {string | number} [K=string|number]
 * @typedef KeyedLookup
 * @type {{ [key: string]: Value }}
 */

/**
 * @template {Record<string, any>} T
 * @typedef KeyedTrue
 * @type {{ [Key in keyof T]?: true }}
 */
