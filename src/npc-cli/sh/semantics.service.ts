import { uid } from "uid";

import type * as Sh from "./parse";
import { jsStringify, last, pause } from "../service/generic";
import { parseJsArg } from "../service/generic";
import useSession, { ProcessStatus } from "./session.store";
import {
  killError,
  expand,
  Expanded,
  literal,
  matchFuncFormat,
  normalizeWhitespace,
  ProcessError,
  ShError,
  singleQuotes,
  killProcess,
  handleProcessError,
} from "./util";
import { cmdService, isTtyAt, sleep } from "./cmd.service";
import { srcService } from "./parse";
import { preProcessWrite, redirectNode } from "./io";
import { cloneParsed, collectIfClauses, reconstructReplParamExp, wrapInFile } from "./parse";

class semanticsServiceClass {
  private async *assignVars(node: Sh.CallExpr) {
    for (const assign of node.Assigns) {
      yield* this.Assign(assign);
    }
  }

  private async applyRedirects(parent: Sh.Command, redirects: Sh.Redirect[]) {
    try {
      for (const redirect of redirects) {
        redirect.exitCode = 0;
        await this.Redirect(redirect);
      }
    } catch (e) {
      parent.exitCode = redirects.find((x) => x.exitCode)?.exitCode ?? 1;
      throw e;
    }
  }

  private expandParameter(meta: Sh.BaseMeta, varName: string): string {
    if (/^\d+$/.test(varName)) {// Positional
      return useSession.api.getPositional(meta.pid, meta.sessionKey, Number(varName));
    } // Otherwise we're retrieving a variable
    const varValue = useSession.api.getVar(meta, varName);
    if (varValue === undefined || typeof varValue === "string") {
      return varValue || "";
    } else {
      return jsStringify(varValue);
    }
  }

  private handleShError(node: Sh.ParsedSh, e: any, prefix?: string) {
    if (e instanceof ProcessError) {
      // We rethrow (unless returning from a shell function)
      handleProcessError(node, e);
    } else if (e instanceof ShError) {
      // We do not rethrow
      const message = [prefix, e.message].filter(Boolean).join(": ");
      useSession.api.writeMsg(node.meta.sessionKey, message, "error");
      console.error(`ShError: ${node.meta.sessionKey}: ${message} (${e.exitCode})`);
      node.exitCode = e.exitCode;
    } else {
      // We do not rethrow
      const message = [prefix, e?.message].filter(Boolean).join(": ");
      useSession.api.writeMsg(node.meta.sessionKey, message, "error");
      console.error(`Internal ShError: ${node.meta.sessionKey}: ${message}`);
      console.error(e);
      node.exitCode = 2;
    }
  }

  handleTopLevelProcessError(e: ProcessError) {
    if (useSession.api.getSession(e.sessionKey) !== undefined) {
      cmdService.killProcesses(e.sessionKey, [e.pid], { group: true, SIGINT: true });
    } else {
      return console.error(`session not found: ${e.sessionKey}`);
    }
  }

  private async lastExpanded(generator: AsyncGenerator<Expanded>) {
    let lastExpanded = undefined as Expanded | undefined;
    for await (const expanded of generator) lastExpanded = expanded;
    return lastExpanded!;
  }

  private async *stmts(parent: Sh.ParsedSh, nodes: Sh.Stmt[]) {
    parent.exitCode = 0;
    for (const node of nodes) {
      try {
        yield* sem.Stmt(node);
      } finally {
        parent.exitCode = node.exitCode;
        useSession.api.setLastExitCode(node.meta, node.exitCode);
      }
    }
  }

  /**
   * We normalise textual input e.g. via parameter substitution,
   * in order to construct a simple/compound command we can run.
   */
  private async performShellExpansion(Args: Sh.Word[]): Promise<string[]> {
    const expanded = [] as string[];
    for (const word of Args) {
      const result = await this.lastExpanded(this.Expand(word));
      const single = word.Parts.length === 1 ? word.Parts[0] : null;
      if (word.exitCode! > 0) {
        throw new ShError("failed to expand word", word.exitCode!);
      } else if (single?.type === "SglQuoted") {
        expanded.push(result.value);
      } else if (single?.type === "ParamExp" || single?.type === "CmdSubst") {
        // e.g. ' foo \nbar ' -> ['foo', 'bar'].
        normalizeWhitespace(result.value).forEach((x) => expanded.push(x));
      } else {
        result.values.forEach((x) => expanded.push(x));
      }
    }
    return expanded;
  }

  private async *Assign({ meta, Name, Value, Naked }: Sh.Assign) {
    if (Naked || !Value) {
      useSession.api.setVar(meta, Name.Value, '');
      return;
    }

    const expanded = await this.lastExpanded(sem.Expand(Value));
    if (expanded.values.some(x => typeof x !== 'string')) {
      // forward non-string values from command substitution `foo=$( bar )`
      useSession.api.setVar(meta, Name.Value,
        expanded.values.length === 1 ? expanded.values[0] : expanded.values,
      );
    } else {
      useSession.api.setVar(meta, Name.Value,
        parseJsArg(expanded.value) // could interpret as number, Set etc.
      );
    }
  }

  private async *BinaryCmd(node: Sh.BinaryCmd) {
    /** All contiguous binary cmds for same operator */
    const cmds = srcService.binaryCmds(node);
    // Restrict to leaves of binary tree, assuming it was
    // originally left-biased e.g. (((A * B) * C) * D) * E
    const stmts = [cmds[0].X].concat(cmds.map(({ Y }) => Y));

    switch (node.Op) {
      case "&&": {
        for (const stmt of stmts) {
          yield* sem.Stmt(stmt);
          if ((node.exitCode = stmt.exitCode)) break;
        }
        break;
      }
      case "||": {
        for (const stmt of stmts) {
          yield* sem.Stmt(stmt);
          if (!(node.exitCode = stmt.exitCode)) break;
        }
        break;
      }
      case "|": {
        const { sessionKey, pid: ppid } = node.meta;
        /** Inherit process group, except 0 */
        const pgid = node.meta.pgid || ppid;
        const { ttyShell } = useSession.api.getSession(sessionKey);

        const process = useSession.api.getProcess(node.meta);
        function killPipeChildren(SIGINT?: boolean) {
          useSession.api
            .getProcesses(process.sessionKey, pgid)
            // 🚧 safety while debug nested-pipeline-issue
            .filter((x) => x.key !== ppid && x.status !== ProcessStatus.Killed)
            .reverse()
            .forEach((x) => killProcess(x, SIGINT));
        }
        process.cleanups.push(killPipeChildren); // Handle Ctrl-C

        const stdIn = useSession.api.resolve(0, stmts[0].meta);
        const fifos = stmts.slice(0, -1).map(({ meta }, i) =>
          useSession.api.createFifo(`/dev/fifo-${sessionKey}-${meta.pid}-${i}`)
        );
        const stdOut = useSession.api.resolve(1, stmts.at(-1)!.meta);

        try {
          // Clone, connecting stdout to stdin of subsequent process
          const clones = stmts.map((x) => wrapInFile(cloneParsed(x), { ppid, pgid }));
          fifos.forEach((fifo, i) => (clones[i + 1].meta.fd[0] = clones[i].meta.fd[1] = fifo.key));

          let errors = [] as any[];
          let exitCode = undefined as undefined | number;
          const cleanupSetupMs = 0; // 🔔 30ms caused restart issue while `events | map key`

          await Promise.allSettled(clones.map((file, i) =>
            new Promise<void>(async (resolve, reject) => {
              try {
                await ttyShell.spawn(file, {
                  localVar: true,
                  cleanups: // for e.g. `take 3 | true`
                    i === 0 && isTtyAt(file.meta, 0)
                      ? [() => ttyShell.finishedReading()]
                      : [],
                });
                resolve();
              } catch (e) {
                errors.push(e);
                reject(e);
              } finally {
                (fifos[i] ?? stdOut).finishedWriting(); // pipe-child `i` won't write any more
                (fifos[i - 1] ?? stdIn).finishedReading(); // pipe-child `i` won't read any more

                if (i === clones.length - 1 && errors.length === 0) {
                  exitCode = file.exitCode ?? 0;
                } else if (errors.length !== 1) {
                  return; // No error, or already handled
                }
                // 🔔 Kill other pipe-children (delay permits cleanup setup)
                setTimeout(killPipeChildren, cleanupSetupMs);
              }
            })
          ));
          // 🔔 Avoid above `killPipeChildren` killing children of next pipeline
          // e.g. call '() => { throw "❌" }' | true; true | { sleep 1; echo 🔔; }
          await pause(cleanupSetupMs);

          if (
            exitCode === undefined ||
            exitCode === 130 ||
            process.status === ProcessStatus.Killed
          ) {
            node.exitCode = errors[0]?.exitCode ?? 1;
            throw killError(node.meta);
          } else {
            node.exitCode = exitCode;
          }
        } finally {
          fifos.forEach((fifo) => {
            fifo.finishedWriting();
            useSession.api.removeDevice(fifo.key);
          });
        }
        break;
      }
      default:
        throw new ShError(`binary command ${node.Op} unsupported`, 2);
    }
  }

  private Block(node: Sh.Block) {
    return this.stmts(node, node.Stmts);
  }

  private async *CallExpr(node: Sh.CallExpr) {
    node.exitCode = 0; // 🚧 justify
    const args = await sem.performShellExpansion(node.Args);
    const [command, ...cmdArgs] = args;
    node.meta.verbose && console.log("simple command", args);

    if (args.length) {
      let func: Sh.NamedFunction | undefined;
      if (cmdService.isCmd(command)) {
        yield* cmdService.runCmd(node, command, cmdArgs);
      } else if ((func = useSession.api.getFunc(node.meta.sessionKey, command))) {
        await cmdService.launchFunc(node, func, cmdArgs);
      } else {
        try {
          // Try to `get` things instead
          for (const arg of args) {
            const result = cmdService.get(node, [arg]);
            if (result[0] !== undefined || matchFuncFormat(arg)) {
              yield* result;
            } else {
              // Throw if get undefined, unless invoked func
              throw Error();
            }
          }
        } catch {
          throw new ShError("not found", 127);
        }
      }
    } else {
      yield* sem.assignVars(node);
    }
  }

  /** Construct a simple command or a compound command. */
  private async *Command(node: Sh.Command, Redirs: Sh.Redirect[]) {
    try {
      await sem.applyRedirects(node, Redirs);

      let generator: AsyncGenerator<any, void, unknown>;
      if (node.type === "CallExpr") {
        generator = this.CallExpr(node);
      } else {
        switch (node.type) {
          case "Block":
            generator = this.Block(node);
            break;
          case "BinaryCmd":
            generator = this.BinaryCmd(node);
            break;
          // syntax.LangBash only
          case "DeclClause":
            generator = this.DeclClause(node);
            break;
          case "FuncDecl":
            generator = this.FuncDecl(node);
            break;
          case "IfClause":
            generator = this.IfClause(node);
            break;
          case "TimeClause":
            generator = this.TimeClause(node);
            break;
          case "Subshell":
            generator = this.Subshell(node);
            break;
          case "WhileClause":
            generator = this.WhileClause(node);
            break;
          default:
            throw new ShError("not implemented", 2);
        }
      }
      const process = useSession.api.getProcess(node.meta);
      let stdoutFd = node.meta.fd[1];
      let device = useSession.api.resolve(1, node.meta);
      if (device === undefined) {// Pipeline already failed
        throw killError(node.meta);
      }

      // 🔔 Actually run the code
      for await (const item of generator) {
        await preProcessWrite(process, device);
        if (node.meta.fd[1] !== stdoutFd) {
          // e.g. `say` redirects stdout to /dev/voice
          stdoutFd = node.meta.fd[1];
          device = useSession.api.resolve(1, node.meta);
        }
        await device.writeData(item);
      }
    } catch (e) {
      // e.g. CallExpr `foo=bar` has no command
      const command = node.type === "CallExpr" ? node.Args[0]?.string : node.type;
      const error = e instanceof ShError ? e : new ShError("", 1, e as Error);
      error.message = `${node.meta.stack.concat(command ?? []).join(": ")}: ${
        (e as Error).message || e
      }`;
      if (command === "run" && node.meta.stack.length === 0) {
        // When directly using `run`, append helpful error message
        error.message += `\n\rformat \`run {async_generator}\` e.g. run \'({ api:{read} }) { yield "foo"; yield await read(); }\'`;
      }
      sem.handleShError(node, e);
    }
  }

  /** Bash language variant only? */
  private async *DeclClause(node: Sh.DeclClause) {
    if (node.Variant.Value === "declare") {
      if (node.Args.length) {
        // TODO support options e.g. interpret as json
        for (const assign of node.Args) yield* this.Assign(assign);
      } else {
        node.exitCode = 0;
        yield* cmdService.runCmd(node, "declare", []);
      }
    } else if (node.Variant.Value === "local") {
      for (const arg of node.Args) {
        const process = useSession.api.getProcess(node.meta);
        if (process.key > 0) {
          // Can only set local variable outside session leader,
          // where variables are e.g. /home/foo
          process.localVar[arg.Name.Value] = undefined;
        }
        yield* this.Assign(arg);
      }
    } else {
      throw new ShError(`Command: DeclClause: ${node.Variant.Value} unsupported`, 2);
    }
  }

  /**
   * Expand a `Word` which has `Parts`.
   */
  private async *Expand(node: Sh.Word) {
    if (node.Parts.length > 1) {
      for (const wordPart of node.Parts) {
        wordPart.string = (await this.lastExpanded(sem.ExpandPart(wordPart))).value;
      }
      /** Is last value a parameter/command-expansion AND has trailing whitespace? */
      let lastTrailing = false;
      /** Items can be arrays via brace expansion of literals */
      const values = [] as (string | string[])[];

      for (const part of node.Parts) {
        const value = part.string!;
        const brace = part.type === "Lit" && (part as any).braceExp;

        if (part.type === "ParamExp" || part.type === "CmdSubst") {
          const vs = normalizeWhitespace(value!, false); // Do not trim
          if (!vs.length) {
            continue;
          } else if (!values.length || lastTrailing || vs[0].startsWith(" ")) {
            // Freely add, although trim 1st and last
            values.push(...vs.map((x) => x.trim()));
          } else if (last(values) instanceof Array) {
            values.push((values.pop() as string[]).map((x) => `${x}${vs[0].trim()}`));
            values.push(...vs.slice(1).map((x) => x.trim()));
          } else {
            // Either `last(vs)` a trailing quote, or it has no trailing space
            // Since vs[0] has no leading space we must join words
            values.push(values.pop() + vs[0].trim());
            values.push(...vs.slice(1).map((x) => x.trim()));
          }
          lastTrailing = last(vs)!.endsWith(" ");
        } else if (values.length === 0 || lastTrailing === true) {
          // Freely add
          values.push(brace ? value.split(" ") : value);
          lastTrailing = false;
        } else if (last(values) instanceof Array) {
          values.push(
            brace
              ? (values.pop() as string[]).flatMap((x) => value.split(" ").map((y) => `${x}${y}`))
              : (values.pop() as string[]).map((x) => `${x}${value}`)
          );
          lastTrailing = false;
        } else if (brace === true) {
          const prev = values.pop() as string;
          values.push(value.split(" ").map((x) => `${prev}${x}`));
          lastTrailing = false;
        } else {
          values.push(values.pop() + value);
          lastTrailing = false;
        }
      }

      const allValues = values.flatMap((x) => x);
      node.string = allValues.join(" ");
      yield expand(allValues);
    } else {
      for await (const expanded of this.ExpandPart(node.Parts[0])) {
        node.string = expanded.value;
        yield expanded;
      }
    }
  }

  private async *ExpandPart(node: Sh.WordPart) {
    switch (node.type) {
      case "DblQuoted": {
        const output = [] as string[];
        for (const part of node.Parts) {
          const result = await this.lastExpanded(sem.ExpandPart(part));
          if (part.type === "ParamExp" && part.Param.Value === "@") {
            output.push(
              ...(node.Parts.length === 1
                ? result.values // "$@" empty if `result.values` is
                : [`${output.pop() || ""}${result.values[0] || ""}`, ...result.values.slice(1)])
            );
          } else {
            output.push(`${output.pop() || ""}${result.value || ""}`);
          }
        }
        yield expand(output);
        return;
      }
      case "Lit": {
        const literals = literal(node);
        // 🔔 HACK: pass `braceExp` to *Expand
        literals.length > 1 && Object.assign(node, { braceExp: true });
        yield expand(literals);
        break;
      }
      case "SglQuoted": {
        yield expand(singleQuotes(node));
        break;
      }
      case "CmdSubst": {
        const fifoKey = `/dev/fifo-cmd-${uid()}`;
        const device = useSession.api.createFifo(fifoKey);
        const cloned = wrapInFile(cloneParsed(node));
        cloned.meta.fd[1] = device.key;

        const { ttyShell } = useSession.api.getSession(node.meta.sessionKey);
        await ttyShell.spawn(cloned, { localVar: true });

        try {
          const values = device.readAll();
          if (node.parent?.type === 'Word' && node.parent.Parts.length === 1 && node.parent.parent?.type === 'Assign') {
            // In case `foo=$( bar )` we forward non-string values
            yield expand(values);
          } else {
            yield expand(values
              .map((x: any) => (typeof x === "string" ? x : jsStringify(x)))
              .join("\n")
              .replace(/\n*$/, "") // remove trailing newlines
            );
          }
        } finally {
          useSession.api.removeDevice(device.key);
        }
        break;
      }
      case "ParamExp": {
        yield* this.ParamExp(node);
        return;
      }
      case "ArithmExp":
      case "ExtGlob":
      case "ProcSubst":
      default:
        throw Error(`${node.type} unimplemented`);
    }
  }

  File(node: Sh.File) {
    return sem.stmts(node, node.Stmts);
  }

  private async *FuncDecl(node: Sh.FuncDecl) {
    const clonedBody = cloneParsed(node.Body);
    const wrappedFile = wrapInFile(clonedBody);
    useSession.api.addFunc(node.meta.sessionKey, node.Name.Value, wrappedFile);
    node.exitCode = 0;
  }

  private async *IfClause(node: Sh.IfClause) {
    for (const { Cond, Then } of collectIfClauses(node)) {
      if (Cond.length) {
        // if | elif i.e. have a test
        yield* sem.stmts(node, Cond);
        // console.log(last(Cond))

        if (last(Cond)!.exitCode === 0) {
          // Test succeeded
          yield* sem.stmts(node, Then);
          node.exitCode = last(Then)?.exitCode || 0;
          return;
        }
      } else {
        // else
        yield* sem.stmts(node, Then);
        node.exitCode = last(Then)?.exitCode || 0;
        return;
      }
    }
  }

  /**
   * 1. $0, $1, ... Positionals
   * 2. "${@}" All positionals
   * 3. $x, ${foo} Vanilla expansions
   * 4. ${foo:-bar} Default when empty
   * 5. ${_/foo/bar/baz} Path into last interactive non-string
   * 6. $$ PID of current process (Not quite the same as bash)
   * 7. $? Exit code of last completed process
   */
  private async *ParamExp(node: Sh.ParamExp): AsyncGenerator<Expanded, void, unknown> {
    const { meta, Param, Slice, Repl, Length, Excl, Exp } = node;
    if (Repl) {
      // ${_/foo/bar/baz}
      const origParam = reconstructReplParamExp(Repl);
      yield expand(jsStringify(cmdService.get(node, [origParam])[0]));
    } else if (Excl || Length || Slice) {
      throw new ShError(`ParamExp: ${Param.Value}: unsupported operation`, 2);
    } else if (Exp) {
      switch (Exp.Op) {
        case ":-": {
          const value = this.expandParameter(meta, Param.Value);
          yield value === "" && Exp.Word
            ? await this.lastExpanded(this.Expand(Exp.Word))
            : expand(value);
          break;
        }
        default:
          throw new ShError(`ParamExp: ${Param.Value}: unsupported operation`, 2);
      }
    } else if (Param.Value === "@") {
      yield expand(useSession.api.getProcess(meta).positionals.slice(1));
    } else if (Param.Value === "$") {
      yield expand(`${meta.pid}`);
    } else if (Param.Value === "?") {
      yield expand(`${useSession.api.getLastExitCode(meta)}`);
    } else {
      yield expand(this.expandParameter(meta, Param.Value));
    }
  }

  private async Redirect(node: Sh.Redirect) {
    if (node.Op === ">" || node.Op === ">>") {
      const { value } = await this.lastExpanded(sem.Expand(node.Word));
      if (value === "/dev/null") {
        return redirectNode(node.parent!, { 1: "/dev/null" });
      } else if (value === "/dev/voice") {
        return redirectNode(node.parent!, { 1: "/dev/voice" });
      } else {
        const varDevice = useSession.api.createVarDevice(
          node.meta,
          value,
          node.Op === ">" ? "last" : "array"
        );
        return redirectNode(node.parent!, { 1: varDevice.key });
      }
    }
    throw new ShError(`${node.Op}: unsupported redirect`, 127);
  }

  private async *Stmt(stmt: Sh.Stmt) {
    if (!stmt.Cmd) {
      throw new ShError("pure redirects are unsupported", 2);
    } else if (stmt.Background && stmt.meta.pgid === 0) {
      /**
       * Run a background process without awaiting.
       */
      const { ttyShell, nextPid } = useSession.api.getSession(stmt.meta.sessionKey);
      const file = wrapInFile(cloneParsed(stmt), {
        ppid: stmt.meta.pid,
        pgid: nextPid,
        background: true,
      });
      ttyShell.spawn(file, { localVar: true }).catch((e) => {
        if (e instanceof ProcessError) {
          this.handleTopLevelProcessError(e);
        } else {
          console.error("background process error", e);
        }
      });
      stmt.exitCode = stmt.Negated ? 1 : 0;
    } else {
      try {
        // Run a simple or compound command
        yield* sem.Command(stmt.Cmd, stmt.Redirs);
      } finally {
        stmt.exitCode = stmt.Cmd.exitCode;
        stmt.Negated && (stmt.exitCode = 1 - Number(!!stmt.Cmd.exitCode));
      }
    }
  }

  private async *Subshell(node: Sh.Subshell) {
    const cloned = wrapInFile(cloneParsed(node));
    const { ttyShell } = useSession.api.getSession(node.meta.sessionKey);
    await ttyShell.spawn(cloned, { localVar: true });
  }

  /** Bash language variant only? */
  private async *TimeClause(node: Sh.TimeClause) {
    const before = Date.now(); // Milliseconds since epoch
    if (node.Stmt) {
      yield* sem.Stmt(node.Stmt);
    }
    useSession.api.resolve(1, node.meta).writeData(`real\t${Date.now() - before}ms`);
  }

  private async *WhileClause(node: Sh.WhileClause) {
    const { Cond, Do, Until } = node;
    const process = useSession.api.getProcess(node.meta);
    let itStartMs = -1, itLengthMs = 0;

    while (true) {
      if (process.status === ProcessStatus.Killed) {
        throw killError(node.meta);
      }
      // Force iteration to take at least 1 second
      if ((itLengthMs = Date.now() - itStartMs) < 1000) {
        yield* sleep(node.meta, 1 - itLengthMs / 1000);
      }
      itStartMs = Date.now();

      yield* this.stmts(node, Cond);

      if (Until ? !node.exitCode : node.exitCode) {
        // e.g. consider `while false; do echo foo; done`
        node.exitCode = 0;
        break;
      }

      yield* this.stmts(node, Do);
    }
  }
}

export const semanticsService = new semanticsServiceClass();

/** Local shortcut */
const sem = semanticsService;
