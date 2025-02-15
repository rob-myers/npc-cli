import cliColumns from "cli-columns";
import { uid } from "uid";

import { ansi, EOF } from "./const";
import {
  Deferred,
  deepGet,
  keysDeep,
  pause,
  removeFirst,
  generateSelector,
  testNever,
  truncateOneLine,
  jsStringify,
  safeJsonCompact,
} from "../service/generic";
import { parseJsArg, parseJsonArg } from "../service/generic";
import {
  addStdinToArgs,
  computeNormalizedParts,
  formatLink,
  handleProcessError,
  killError,
  killProcess,
  normalizeAbsParts,
  parseTtyMarkdownLinks,
  ProcessError,
  resolveNormalized,
  resolvePath,
  ShError,
  stripAnsi,
} from "./util";
import type * as Sh from "./parse";
import {
  ReadResult,
  preProcessRead,
  dataChunk,
  isProxy,
  redirectNode,
  VoiceCommand,
  isDataChunk,
} from "./io";
import useSession, { ProcessMeta, ProcessStatus, Session } from "./session.store";
import { cloneParsed, getOpts, parseService } from "./parse";
import { ttyShellClass } from "./tty.shell";

import { getCached } from "../service/query-client";
import { observableToAsyncIterable } from "../service/observable-to-async-iterable";

/** Shell builtins */
const commandKeys = {
  /** Change current key prefix */
  cd: true,
  /** Write tty message with markdown links and associated actions */
  choice: true,
  /** List function definitions */
  declare: true,
  /** Output arguments as space-separated string */
  echo: true,
  /** Exit with code 1 */
  false: true,
  /** Get each arg from __TODO__ */
  get: true,
  /** List commands */
  help: true,
  /** List previous commands */
  history: true,
  /** Kill a process */
  kill: true,
  /** Local variables */
  local: true,
  /** List variables */
  ls: true,
  /** List running processes */
  ps: true,
  /** Print current key prefix */
  pwd: true,
  /** Exit from a function */
  return: true,
  /** Remove variable(s) */
  rm: true,
  /** Run a javascript generator */
  run: true,
  /** Speech synthesis */
  say: true,
  /** Echo session key */
  session: true,
  /** Set something */
  set: true,
  /** Left-shift positional parameters */
  shift: true,
  /** Wait for specified number of seconds */
  sleep: true,
  /** Run shell code stored as a string somewhere */
  source: true,
  /** Evaluate javascript expression and exit code 1 <=> truthy */
  test: true,
  /** Exit with code 0 */
  true: true,
  /** Unset top-level variables and shell functions */
  unset: true,
};

type CommandName = keyof typeof commandKeys;

class cmdServiceClass {
  isCmd(word: string): word is CommandName {
    return word in commandKeys;
  }

  async *runCmd(node: Sh.CallExpr | Sh.DeclClause, command: CommandName, args: string[]) {
    const { meta } = node;
    switch (command) {
      case "cd": {
        if (args.length > 1) {
          throw new ShError(
            "usage: `cd /`, `cd`, `cd foo/bar`, `cd /foo/bar`, `cd ..` and `cd -`",
            1
          );
        }
        const prevPwd: string = useSession.api.getVar(meta, "OLDPWD");
        const currPwd: string = useSession.api.getVar(meta, "PWD");
        useSession.api.setVar(meta, "OLDPWD", currPwd);

        try {
          if (!args[0]) {
            useSession.api.setVar(meta, "PWD", "home");
          } else if (args[0] === "-") {
            useSession.api.setVar(meta, "PWD", prevPwd);
          } else if (args[0].startsWith("/")) {
            const parts = normalizeAbsParts(args[0].split("/"));
            if (resolveNormalized(parts, this.provideProcessCtxt(node.meta)) === undefined) {
              throw Error;
            }
            useSession.api.setVar(meta, "PWD", parts.join("/"));
          } else {
            const parts = normalizeAbsParts(currPwd.split("/").concat(args[0].split("/")));
            if (resolveNormalized(parts, this.provideProcessCtxt(node.meta)) === undefined) {
              throw Error;
            }
            useSession.api.setVar(meta, "PWD", parts.join("/"));
          }
        } catch {
          useSession.api.setVar(meta, "OLDPWD", prevPwd);
          throw new ShError(`${args[0]} not found`, 1);
        }
        break;
      }
      case "choice": {
        if (isTtyAt(meta, 0)) {
          // `choice {textWithLinks}+` where text may contain newlines
          const text = args.join(" ");
          yield await this.choice(meta, { text });
        } else {
          // `choice` expects to read `ChoiceReadValue`s
          let datum: ChoiceReadValue;
          while ((datum = await read(meta)) !== EOF)
            yield await this.choice(meta, datum);
        }
        break;
      }
      case "declare": {// 🔔 see DeclClause
        const { opts, operands } = getOpts(args, {
          boolean: [
            "f", // list functions [matching prefixes]
            "F", // list function names [matching prefixes]
            "x", // list variables [matching prefixes]
            "p", // list variables [matching prefixes]
          ],
        });

        const noOpts = [opts.x, opts.p, opts.f, opts.F].every((opt) => opt !== true);
        const showVars = opts.x === true || opts.p === true || noOpts;
        const showFuncs = opts.f === true || noOpts;
        const showFuncNames = opts.F === true;
        // Only match prefixes when some option specified
        const prefixes = operands.length && !noOpts ? operands : null;

        const {
          var: home,
          func,
          ttyShell: { xterm },
          process: {
            [meta.pid]: { inheritVar },
          },
        } = useSession.api.getSession(meta.sessionKey);

        const vars = { ...home, ...inheritVar };
        const funcs = Object.values(func);

        if (showVars) {
          for (const [key, value] of Object.entries(vars)) {
            if (prefixes && !prefixes.some((x) => key.startsWith(x))) continue;
            yield `${ansi.Blue}${key}${ansi.Reset}=${
              typeof value === "string" ? ansi.White : ansi.BrightYellow
            }${jsStringify(value).slice(-xterm.maxStringifyLength)}${ansi.Reset}`;
          }
        }
        if (showFuncs) {
          // If 1 prefix and exact match, we'll only show exact match,
          // so that `declare -f foo` works as expected
          const exactMatch =
            prefixes?.length == 1 ? prefixes.find((prefix) => func[prefix]) : undefined;
          for (const { key, src } of funcs) {
            if (prefixes && !prefixes.some((x) => key.startsWith(x))) continue;
            if (exactMatch && key !== exactMatch) continue;
            const lines =
              `${ansi.Blue}${key}${ansi.White} ()${ansi.BoldReset} ${src}${ansi.Reset}`.split(
                /\r?\n/
              );
            yield* lines;
            yield "";
          }
        }
        if (showFuncNames) {
          for (const { key } of funcs) {
            if (prefixes && !prefixes.some((x) => key.startsWith(x))) continue;
            yield `${ansi.White}declare -f ${key}${ansi.Reset}`;
          }
        }
        break;
      }
      case "echo": {
        const { opts, operands } = getOpts(args, {
          boolean: [
            "a", // output array
            "n", // cast as numbers
          ],
        });
        if (opts.a) {
          yield opts.n ? operands.map(Number) : operands;
        } else if (opts.n) {
          for (const operand of operands) yield Number(operand);
        } else {
          yield operands.join(" ");
        }
        break;
      }
      case "false": {
        node.exitCode = 1;
        break;
      }
      case "get": {
        yield* this.get(node, args);
        break;
      }
      case "help": {
        const { ttyShell } = useSession.api.getSession(meta.sessionKey);
        yield `The following commands are supported:`;
        const commands = cliColumns(Object.keys(commandKeys), {
          width: ttyShell.xterm.xterm.cols,
        }).split(/\r?\n/);
        for (const line of commands) yield `${ansi.Blue}${line}`;
        // yield `Traverse context via \`ls\` or \`ls -l var.foo.bar\` (Object.keys).`
        yield `\n\rView shell functions via ${ansi.Blue}declare -F${ansi.Reset}.`;
        // yield `Use Ctrl-c to interrupt and Ctrl-l to clear screen.`
        // yield `View history via up/down or \`history\`.`
        // yield `Traverse input using Option-left/right and Ctrl-{a,e}.`
        // yield `Delete input using Ctrl-{w,u,k}.`
        // yield `You can copy and paste.`
        // yield `Features: functions, pipes, command substitution, background processes, history, readline-esque shortcuts, copy-paste.`
        break;
      }
      case "history": {
        const { ttyShell } = useSession.api.getSession(meta.sessionKey);
        const history = ttyShell.getHistory();
        for (const line of history) yield line;
        break;
      }
      case "kill": {
        const { opts, operands } = getOpts(args, {
          boolean: [
            "STOP" /** --STOP pauses a process */,
            "CONT" /** --CONT continues a paused process */,
          ],
        });

        const pids = operands
          .map((x) => parseJsonArg(x))
          .filter((x): x is number => Number.isFinite(x));

        this.killProcesses(meta.sessionKey, pids, { STOP: opts.STOP, CONT: opts.CONT });
        break;
      }
      case "local": {// 🔔 see DeclClause
        const process = useSession.api.getProcess(node.meta);
        if (process.key === 0) {
          throw new ShError("session leader doesn't support local variables", 1);
        }
        if (args.join(" ").includes("=")) {
          throw new ShError("usage: `local x y z` (assign values elsewhere)", 1);
        }
        for (const name of args) {
          if (name) {
            process.localVar[name] = undefined;
          }
        }
        break;
      }
      case "ls": {
        const { opts, operands } = getOpts(args, {
          boolean: [
            "1" /** One line per item */,
            "l" /** Detailed */,
            "r" /** Recursive properties (prototype) */,
            "a" /** Show capitalized vars at top level */,
          ],
        });
        const pwd = useSession.api.getVar(meta, "PWD");
        const queries = operands.length ? operands.slice() : [""];
        const root = this.provideProcessCtxt(meta);
        const roots = queries.map((path) => resolvePath(path, root, pwd));

        const { ttyShell } = useSession.api.getSession(node.meta.sessionKey);
        for (const [i, obj] of roots.entries()) {
          if (obj === undefined) {
            useSession.api.writeMsg(meta.sessionKey, `ls: "${queries[i]}" is not defined`, "error");
            continue;
          }

          if (roots.length > 1) yield `${ansi.Blue}${queries[i]}:`;
          let keys = (opts.r ? keysDeep(obj) : Object.keys(obj)).sort();
          let items = [] as string[];
          if (pwd === "home" && !opts.a)
            keys = keys.filter((x) => x.toUpperCase() !== x || /^[0-9]/.test(x));

          if (opts.l) {
            if (typeof obj === "function")
              keys = keys.filter((x) => !["caller", "callee", "arguments"].includes(x));
            const metas = opts.r
              ? keys.map(
                  (x) =>
                    deepGet(obj, x.split("/"))?.constructor?.name ||
                    (obj[x] === null ? "null" : "undefined")
                )
              : keys.map(
                  (x) => obj[x]?.constructor?.name || (obj[x] === null ? "null" : "undefined")
                );
            const metasWidth = Math.max(...metas.map((x) => x.length));
            items = keys.map(
              (x, i) =>
                `${ansi.BrightYellow}${metas[i].padEnd(metasWidth)}${ansi.White} ${x}${ansi.Reset}`
            );
          } else if (opts[1]) {
            items = keys;
          } else {
            items = cliColumns(keys, { width: ttyShell.xterm.xterm.cols }).split(/\r?\n/);
          }
          for (const item of items) yield item;
        }
        break;
      }
      case "ps": {
        const { opts } = getOpts(args, {
          boolean: ["a" /** Show all processes */, "s" /** Show process src */],
        });

        const allProcesses = useSession.api.getSession(meta.sessionKey).process;

        /** Either all processes, or all group leaders */
        const processes = opts.a
          ? allProcesses
          : Object.values(allProcesses).reduce(
              (agg, proc) => (proc.key === proc.pgid && (agg[proc.key] = proc), agg),
              {} as typeof allProcesses,
            )
        ;

        const statusColour: Record<ProcessStatus, string> = {
          0: ansi.DarkGrey,
          1: ansi.White,
          2: ansi.Red,
        };
        const statusLinks: Record<ProcessStatus, string> = {
          0: `${formatLink(`${statusColour[0]} no `)} ${formatLink(`${statusColour[2]} x `)}`,
          1: `${formatLink(`${statusColour[1]} on `)} ${formatLink(`${statusColour[2]} x `)}`,
          2: "",
        };

        function getProcessDescendants(leader: ProcessMeta) {// 🚧 better way?
          const lookup = { [leader.key]: true };
          Object.values(useSession.api.getSession(meta.sessionKey).process).forEach((other) => {
            if (other.ppid in lookup) lookup[other.key] = true;
          });
          return Object.keys(lookup).slice(1).filter((pid) => processes[pid]);
        }

        function shouldSuppressLinks(process: ProcessMeta) {
          return (
            process.status === ProcessStatus.Killed ||
            process.key === 0 || // suppress links when leader has descendant leader
            (!opts.a && !opts.s && getProcessDescendants(process).length > 0)
          );
        }

        function getProcessLineWithLinks(p: ProcessMeta) {
          const info = [p.key, p.ppid, p.pgid].map(x => `${x}`.padEnd(5)).join(' ');
          const hasLinks = !shouldSuppressLinks(p);
          const linksOrEmpty = hasLinks ? `${statusLinks[p.status]} ` : '';
          const tagsOrEmpty = p.ptags !== undefined ? `${ansi.BrightYellow}${opts.s ? jsStringify(p.ptags) : '* '}${ansi.Reset}` : '';
          const oneLineSrcOrEmpty = !opts.s ? truncateOneLine(p.src.trimStart(), 30) : '';
          const line = `${statusColour[p.status]}${info}${ansi.Reset}${linksOrEmpty}${tagsOrEmpty}${oneLineSrcOrEmpty}`;
          if (hasLinks === true) registerStatusLinks(p, line);
          return line;
        }

        function registerStatusLinks(process: ProcessMeta, processLine: string) {
          const lineText = stripAnsi(processLine);

          function updateLine(lineNumber: number) {
            useSession.api.removeTtyLineCtxts(meta.sessionKey, lineText);
            const { xterm: ttyXterm } = useSession.api.getSession(meta.sessionKey).ttyShell;
            lineNumber = ttyXterm.getWrapStartLineNumber(lineNumber);
            ttyXterm.replaceLine(lineNumber, getProcessLineWithLinks(process));
          }

          useSession.api.addTtyLineCtxts(meta.sessionKey, lineText, [
            {
              lineText,
              linkText: "on",
              linkStartIndex: lineText.indexOf("on") - 1,
              callback(lineNumber) {
                cmdService.killProcesses(meta.sessionKey, [process.key], { STOP: true });
                updateLine(lineNumber);
              },
            },
            {
              lineText,
              linkText: "no",
              linkStartIndex: lineText.indexOf("no") - 1,
              callback(lineNumber) {
                cmdService.killProcesses(meta.sessionKey, [process.key], { CONT: true });
                updateLine(lineNumber);
              },
            },
            {
              lineText,
              linkText: "x",
              linkStartIndex: lineText.indexOf("x") - 1,
              async callback(lineNumber) {
                cmdService.killProcesses(meta.sessionKey, [process.key]);
                updateLine(lineNumber);
              },
            },
          ]);
        }

        const title = ["pid", "ppid", "pgid"].map((x) => x.padEnd(5)).join(" ");
        yield `${ansi.Blue}${title}${ansi.Reset}`;

        for (const process of Object.values(processes)) {
          yield getProcessLineWithLinks(process);
          if (opts.s) {// Avoid multiline white in tty
            yield* process.src.split("\n").map((x) => `${ansi.Reset}${x}`);
          }
        }

        break;
      }
      case "pwd": {
        yield "/" + useSession.api.getVar(meta, "PWD");
        break;
      }
      case "return": {
        let exitCode = parseInt(args[0] || "1");
        if (!Number.isFinite(exitCode)) {
          useSession.api.writeMsg(meta.sessionKey, `return: numeric argument required`, "error");
          exitCode = 2;
        }
        throw killError(
          meta,
          Number.isInteger(exitCode) ? exitCode : useSession.api.getLastExitCode(meta),
          1 // Terminate parent e.g. a shell function
        );
      }
      case "rm": {
        const root = this.provideProcessCtxt(meta);
        const pwd = useSession.api.getVar<string>(meta, "PWD");
        for (const path of args) {
          const parts = computeNormalizedParts(path, pwd);
          if (parts[0] === "home" && parts.length > 1) {
            const last = parts.pop() as string;
            delete resolveNormalized(parts, root)[last];
          } else {
            throw new ShError(`cannot delete ${path}`, 1);
          }
        }
        break;
      }
      /** e.g. run '({ api:{read} }) { yield "foo"; yield await read(); }' */
      case "run": {
        try {
          const fnName = meta.stack.at(-1) || "generator";
          const func = Function("_", `return async function *${fnName} ${args[0]}`);
          yield* func()(this.provideProcessCtxt(meta, args.slice(1)));
        } catch (e) {
          if (e instanceof ProcessError) {
            handleProcessError(node, e);
          } else if (e instanceof ShError) {
            node.exitCode = e.exitCode;
            // Permit silent errors i.e. just set exit code
            if (e.message.length > 0) {
              throw e;
            }
          } else {
            console.error(e); // Provide JS stack
            node.exitCode = 1;
            throw new ShError(`${(e as Error)?.message ?? e}`, 1);
          }
        }
        break;
      }
      case "say": {
        const { opts, operands } = getOpts(args, {
          string: ["v"],
        });

        if (opts.v === "?") {
          // List available voices
          yield* window.speechSynthesis.getVoices().map(({ name, lang }) => `${name} (${lang})`);
          return;
        }

        redirectNode(node.parent!, { 1: "/dev/voice" });

        const process = getProcess(meta);
        process.cleanups.push(() => window.speechSynthesis.cancel());
        process.onSuspends.push(() => {
          window.speechSynthesis.pause();
          return true;
        });
        process.onResumes.push(() => {
          window.speechSynthesis.resume();
          return true;
        });

        if (!operands.length) {
          // Say lines from stdin
          let datum: string | VoiceCommand | null;
          while ((datum = await read(meta)) !== EOF) {
            yield { voice: opts.v, text: `${datum}` };
          }
        } else {
          // Say operands
          yield { voice: opts.v, text: operands.join(" ") };
        }

        break;
      }
      case "session": {
        yield meta.sessionKey;
        break;
      }
      case "set": {
        const root = this.provideProcessCtxt(meta);
        const value = parseJsArg(args[1]);
        if (args[0][0] === "/") {
          Function("__1", "__2", `return __1.${args[0].slice(1)} = __2`)(root, value);
        } else {
          const cwd = this.computeCwd(meta, root);
          Function("__1", "__2", `return __1.${args[0]} = __2`)(cwd, value);
        }
        break;
      }
      case "shift": {
        const shiftBy = Number(args[0] || "1");
        if (!(Number.isInteger(shiftBy) && shiftBy >= 0)) {
          throw new ShError("usage: `shift [n]` for non-negative integer n", 1);
        }
        const { positionals } = useSession.api.getProcess(meta);
        for (let i = 0; i < shiftBy; i++) positionals.shift();
        break;
      }
      case "sleep": {
        const seconds = args.length ? parseFloat(parseJsonArg(args[0])) || 0 : 1;
        await sleep(meta, seconds);
        break;
      }
      case "source": {
        if (args[0] === undefined) {
          return;
        }
        const script = this.get(node, [args[0]])[0];
        if (script === undefined) {
          useSession.api.writeMsg(meta.sessionKey, `source: "${args[0]}" not found`, "error");
        } else if (typeof script !== "string") {
          useSession.api.writeMsg(meta.sessionKey, `source: "${args[0]}" does not resolve as a string`, "error");
        } else {
          // We cache scripts
          const parsed = parseService.parse(script, true);
          // We mutate `meta` because it may occur many times deeply in tree
          // Also, pid will be overwritten in `ttyShell.spawn`
          Object.assign(parsed.meta, { ...meta, ppid: meta.pid, fd: { ...meta.fd }, stack: meta.stack.slice() });
          const { ttyShell } = useSession.api.getSession(meta.sessionKey);
          // We spawn a new process (unlike bash `source`), but we don't localize PWD
          await ttyShell.spawn(parsed, { leading: meta.pid === 0, posPositionals: args.slice(1) });
        }
        break;
      }
      case "test": {
        node.exitCode = !parseJsArg(args.join(" ")) ? 1 : 0;
        break;
      }
      case "true": {
        node.exitCode = 0;
        break;
      }
      case "unset": {
        const {
          var: home,
          func,
          process: { [meta.pid]: process },
        } = useSession.api.getSession(meta.sessionKey);

        for (const arg of args) {
          if (arg in process.localVar) {
            // NOTE cannot unset ancestral variables
            delete process.localVar[arg];
          } else {
            delete home[arg];
            delete func[arg];
          }
        }
        break;
      }
      default:
        throw testNever(command, { suffix: "runCmd" });
    }
  }

  private async choice(meta: Sh.BaseMeta, { text }: ChoiceReadValue) {
    const lines = text.replace(/\r/g, "").split(/\n/);
    const defaultValue = undefined;
    const parsedLines = lines.map((text) => parseTtyMarkdownLinks(text, defaultValue, meta.sessionKey));
    for (const { ttyText } of parsedLines) {
      await useSession.api.writeMsgCleanly(meta.sessionKey, ttyText);
    }

    try {
      if (parsedLines.some((x) => x.linkCtxtsFactory)) {
        // some link must be clicked to proceed
        return await new Promise<any>((resolve, reject) => {
          getProcess(meta).cleanups.push(reject);
          parsedLines.forEach(
            ({ ttyTextKey, linkCtxtsFactory }) =>
              linkCtxtsFactory &&
              useSession.api.addTtyLineCtxts(
                meta.sessionKey,
                ttyTextKey,
                linkCtxtsFactory(resolve)
              )
          );
        })
      }
    } finally {
      // ℹ️ currently assume one time usage
      parsedLines.forEach(({ ttyTextKey }) =>
        useSession.api.removeTtyLineCtxts(meta.sessionKey, ttyTextKey)
      );
    }
  }

  private computeCwd(meta: Sh.BaseMeta, root: any) {
    const pwd = useSession.api.getVar(meta, "PWD");
    return resolveNormalized(pwd.split("/"), root);
  }

  get(node: Sh.BaseNode, args: string[]) {
    const root = this.provideProcessCtxt(node.meta);
    const pwd = useSession.api.getVar<string>(node.meta, "PWD");
    const process = useSession.api.getProcess(node.meta);

    const outputs = args.map((arg) => {
      const parts = arg.split("/");
      const localCtxt =
        parts[0] in process.localVar
          ? process.localVar
          : parts[0] in process.inheritVar
          ? process.inheritVar
          : null;
      return parts[0] && localCtxt
        ? parts.reduce((agg, part) => agg[part], localCtxt)
        : resolvePath(arg, root, pwd);
    });

    node.exitCode = outputs.length && outputs.every((x) => x === undefined) ? 1 : 0;
    return outputs;
  }

  killProcesses(
    sessionKey: string,
    pids: number[],
    opts: {
      STOP?: boolean;
      CONT?: boolean;
      /** Ctrl-C, originating from pid 0 */
      SIGINT?: boolean;
      group?: boolean;
    } = {}
  ) {
    const session = useSession.api.getSession(sessionKey);
    for (const pid of pids) {
      const { [pid]: process } = session.process;
      if (!process) {
        continue; // Already killed
      }
      const processes =
        process.pgid === pid || opts.group
          ? // Apply command to whole process group __in reverse__
            useSession.api.getProcesses(sessionKey, process.pgid).reverse()
          : [process]; // Apply command to exactly one process

      // onSuspend onResume are "first-in first-invoked"
      processes.forEach((p) => {
        if (opts.STOP) {
          p.onSuspends = p.onSuspends.filter((onSuspend) => onSuspend());
          p.status = ProcessStatus.Suspended;
        } else if (opts.CONT) {
          p.onResumes = p.onResumes.filter((onResume) => onResume());
          p.status = ProcessStatus.Running;
        } else {
          p.status = ProcessStatus.Killed;
          // Avoid immediate clean because it stops `sleep` (??)
          window.setTimeout(() => killProcess(p, opts.SIGINT));
        }
      });
    }
  }

  async launchFunc(node: Sh.CallExpr, namedFunc: Sh.NamedFunction, args: string[]) {
    const cloned = cloneParsed(namedFunc.node);
    const { ttyShell } = useSession.api.getSession(node.meta.sessionKey);
    Object.assign(cloned.meta, {
      ...node.meta,
      ppid: node.meta.pid,
      stack: node.meta.stack.concat(namedFunc.key), // TODO elsewhere?
    } as Sh.BaseMeta);
    try {
      // Run function in own process, yet without localized PWD
      await ttyShell.spawn(cloned, { posPositionals: args.slice() });
    } finally {
      // Propagate function exitCode to callee
      // ℹ️ Errors are usually caught earlier via `handleShError`,
      //    but may arise via `kill` or failed pipe-sibling
      node.exitCode = cloned.exitCode;
    }
  }

  private readonly processApi = {
    // Overwritten via Function.prototype.bind.
    meta: {} as Sh.BaseMeta,
    session: {} as Session,

    ansi,

    /** Returns provided cleanup */
    addCleanup(cleanup: () => void) {
      getProcess(this.meta).cleanups.push(cleanup);
      return cleanup;
    },
    /**
     * Executed on suspend, without clearing `true` returners.
     * The latter should be idempotent, e.g. unsubscribe, pause.
     */
    addResume(cleanup: () => void) {
      getProcess(this.meta).onResumes.push(cleanup);
    },
    /**
     * Executed on suspend, without clearing `true` returners.
     * The latter should be idempotent, e.g. unsubscribe, pause.
     */
    addSuspend(cleanup: () => void) {
      getProcess(this.meta).onSuspends.push(cleanup);
    },

    addStdinToArgs,

    dataChunk,

    eof: EOF,

    error(message: string) {
      useSession.api.writeMsgCleanly(this.meta.sessionKey, message, { level: "error" });
    },

    generateSelector,

    getCached,

    getKillError(exitCode?: number) {
      return killError(this.meta, exitCode);
    },

    getOpts,

    getProcess() {
      return getProcess(this.meta);
    },

    getShError(message: string, exitCode = 1) {
      return new ShError(message, exitCode);
    },

    /** Returns a string e.g. `60f5bfdb9b9` */
    getUid() {
      return uid();
    },

    info(message: string) {
      useSession.api.writeMsgCleanly(this.meta.sessionKey, message, { level: "info" });
    },

    isDataChunk,

    /** Is the process running? */
    isRunning() {
      return getProcess(this.meta).status === ProcessStatus.Running;
    },

    isTtyAt(fd = 0) {
      return isTtyAt(this.meta, fd);
    },

    kill(group = false) {
      cmdService.killProcesses(this.meta.sessionKey, [this.meta.pid], { group });
    },

    observableToAsyncIterable,

    /** js parse with string fallback */
    parseJsArg,

    parseFnOrStr,

    /** Output 1, 2, ... at fixed intervals */
    async *poll(args: string[]) {
      const seconds = args.length ? parseFloat(parseJsonArg(args[0])) || 1 : 1;
      const [delayMs, deferred] = [Math.max(seconds, 0.5) * 1000, new Deferred<void>()];
      getProcess(this.meta).cleanups.push(() => deferred.reject(killError(this.meta)));
      let count = 1;
      while (true) {
        yield count++;
        await Promise.race([pause(delayMs), deferred.promise]);
      }
    },

    /** Pretty print JS values */
    pretty(x: any) {
      return jsStringify(isProxy(x) ? { ...x } : x, true);
    },

    /** Create succinct JSON projections of JS values */
    json(x: any) {
      return safeJsonCompact(x);
    },

    /** Read once from stdin. */
    read(chunks?: boolean) {
      return read(this.meta, chunks);
    },

    async eagerReadLoop<T>(loopBody: (datum: T) => Promise<void>, onInterrupt?: (datum: T) => any) {
      let proms = [] as Promise<void>[];
      let datum = await read(this.meta);
      while (datum !== EOF) {
        const resolved = await Promise.race((proms = [loopBody(datum), read(this.meta)]));
        if (resolved === undefined) {
          // Finished loopBody
          datum = await proms[1];
        } else if (resolved === EOF) {
          await proms[0];
          datum = resolved;
        } else {
          // Read before loopBody finished
          await onInterrupt?.(datum);
          datum = resolved;
        }
      }
    },

    async sleep(seconds: number) {
      await sleep(this.meta, seconds);
    },

    verbose(e: any) {
      if (this.session.verbose) {
        useSession.api.writeMsgCleanly(this.meta.sessionKey, `${e?.message ?? e}`, {
          level: "info",
        });
        console.warn(e);
      }
    },
  };

  private readonly processApiKeys = Object.keys(this.processApi);

  private provideProcessCtxt(meta: Sh.BaseMeta, posPositionals: string[] = []) {
    const session = useSession.api.getSession(meta.sessionKey);
    const cacheShortcuts = session.var.CACHE_SHORTCUTS ?? {};
    return new Proxy(
      {
        home: session.var,
        etc: session.etc,
        // cache: queryCache,
        // dev: useSession.getState().device,
      },
      {
        get: (target, key) => {
          if (key === "api") {
            return new Proxy(this.processApi, {
              get(target, key: keyof cmdServiceClass["processApi"]) {
                if (typeof target[key] === "function") {
                  return (target[key] as Function).bind({ meta, session });
                }
                if (key === "meta") {
                  return meta;
                }
                return target[key];
              },
              // 🚧 ownKeys (requires getOwnPropertyDescriptor)
              getOwnPropertyDescriptor() {
                return { enumerable: true, configurable: true };
              },
              ownKeys: (_target) => {
                return this.processApiKeys;
              },
            });
          } else if (key === "args") {
            return posPositionals;
          } else if (key === "_") {
            // Can _ from anywhere e.g. inside root
            const lastValue = session.var._;
            return isProxy(lastValue) ? dataChunk([lastValue]) : lastValue;
          } else if (key in cacheShortcuts) {
            return getCached([session.var[cacheShortcuts[key as string]]]);
          } else {
            return (target as any)[key];
          }
        },
        set: (_, key, value) => {
          if (key === "args") {
            // Assume `posPositionals` is fresh i.e. just sliced
            posPositionals.length = 0;
            posPositionals.push(...value);
            return true;
          }
          return false;
        },
        deleteProperty(_target, _key) {
          return false;
        },
        // getOwnPropertyDescriptor(target, prop) {
        //   return { enumerable: true, configurable: true };
        // },
        ownKeys(target) {
          // return Reflect.ownKeys(target).concat('api', 'args', 'site');
          return Reflect.ownKeys(target);
        },
      }
    );
  }

  private async *readLoop(
    meta: Sh.BaseMeta,
    /** Read exactly one item of data? */
    once = false,
    chunks: boolean
  ) {
    const process = useSession.api.getProcess(meta);
    const device = useSession.api.resolve(0, meta);

    if (device === undefined) {
      return;
    } else if (device instanceof ttyShellClass && meta.background) {
      throw new ShError("background process tried to read tty", 1);
    }

    let result = {} as ReadResult;
    while (!(result = await device.readData(once, chunks)).eof) {
      if (result.data !== undefined) {
        yield result;
        if (once) break;
      }
      await preProcessRead(process, device);
    }
  }

  /**
   * Reading once often means two outputs i.e. `{ data }` then `{ eof: true }`.
   * If there is any real data we return `{ data }`,
   * otherwise we (possibly eventually) return `{ eof: true }`.
   */
  async readOnce(meta: Sh.BaseMeta, chunks: boolean): Promise<ReadResult> {
    for await (const data of this.readLoop(meta, true, chunks)) {
      return data;
    }
    return { eof: true };
  }
}

//#region processApi related

function getProcess(meta: Sh.BaseMeta) {
  return useSession.api.getProcess(meta);
}

export function isTtyAt(meta: Sh.BaseMeta, fd: number) {
  return meta.fd[fd]?.startsWith("/dev/tty-");
}

/**
 * Parse function or regexp, with string fallback.
 */
export function parseFnOrStr(input: string) {
  try {
    const parsed = Function(`return ${input}`)();
    // 🤔 avoid 'toString' -> window.toString
    // 🤔 permit 'String'  -> window.String
    if (typeof parsed === "function" && !(input in window && parsed.length === 0)) {
      return parsed;
    }
    if (parsed instanceof RegExp) {
      return parsed;
    }
  } catch {}
  return input;
}

/**
 * Read once from stdin. We convert `{ eof: true }` to `EOF` for
 * easier assignment, but beware of other falsy values.
 */
async function read(meta: Sh.BaseMeta, chunks = false) {
  const result = await cmdService.readOnce(meta, chunks);
  return result?.eof === true ? EOF : result.data;
}

export async function sleep(meta: Sh.BaseMeta, seconds: number) {
  const process = getProcess(meta);
  
  await new Promise<void>((resolveSleep, rejectSleep) => {
    let durationMs = 1000 * seconds;
    let startedAt = 0;
    let timeoutId = 0;

    function onResume() {
      startedAt = Date.now();
      timeoutId = window.setTimeout(onResolve, durationMs);
    }
    function onSuspend() {
      window.clearTimeout(timeoutId);
      durationMs -= (Date.now() - startedAt);
    }
    function onResolve() {
      removeFirst(process.cleanups, onCleanup);
      resolveSleep();
    }
    function onCleanup() {
      rejectSleep(killError(meta));
    }

    process.onSuspends.push(onSuspend);
    process.onResumes.push(onResume);
    process.cleanups.push(onCleanup);
    onResume();
  });
}

//#endregion

interface ChoiceReadValue {
  text: string;
}

export const cmdService = new cmdServiceClass();

export type CmdService = typeof cmdService;
