import type Sh from "mvdan-sh";
import cloneWithRefs from "lodash.clonedeep";
//@ts-ignore
import getopts from "getopts";
import { testNever, last } from "../service/generic";

// We lazy-load the shell parser `mvdan-sh`.

let syntax = {
  NewParser: class NewParser {
    Interactive() {
      throw Error("mvdan-sh not ready");
    }
    Parse() {
      throw Error("mvdan-sh not ready");
    }
  } as any,
} as typeof MvdanSh.syntax;

export async function loadMvdanSh() {
  syntax = (await import("mvdan-sh")).syntax;
}

//#region model

/** Our notion of position, as opposed to `MvdanSh.Pos`. */
export interface Pos {
  Line: number;
  Col: number;
  Offset: number;
}

/** Our notion of base node, as opposed to `MvdanSh.BaseNode`. */
export interface BaseNode {
  /** Single instance for entire parse tree */
  meta: BaseMeta;
  /** Reference to parent node  */
  parent: null | ParsedSh;
  /** Used for arithmetic/boolean expansion */
  string?: string;
  /** Used to calculate actual exit codes */
  exitCode?: number;
}

export type ParsedSh =
  | ArithmCmd
  | ArithmExp
  | ArrayElem
  | ArithmExpr
  | ArrayExpr
  | Assign
  | BinaryArithm
  | BinaryCmd
  | BinaryTest
  | Block
  | CallExpr
  | CaseClause
  | CaseItem
  | CmdSubst
  | Comment
  | CStyleLoop
  | Command
  | CoprocClause
  | DblQuoted
  | DeclClause
  | ExtGlob
  | File
  | ForClause
  | FuncDecl
  | IfClause
  | LetClause
  | Lit
  | Loop
  | ParamExp
  | ParenArithm
  | ParenTest
  | ProcSubst
  | Redirect
  | SglQuoted
  | Stmt
  | Subshell
  | TestClause
  | TimeClause
  | TestExpr
  | UnaryArithm
  | UnaryTest
  | WhileClause
  | Word
  | WordIter
  | WordPart;

export type ExpandType =
  | ArithmExpr
  | Word // i.e. parts
  | Exclude<WordPart, ArithmExp>;

export type ArithmCmd = Sh.ArithmCmdGeneric<BaseNode, Pos, string>;
export type ArithmExp = Sh.ArithmExpGeneric<BaseNode, Pos, string>;
export type ArrayElem = Sh.ArrayElemGeneric<BaseNode, Pos, string>;
export type ArithmExpr = BinaryArithm | UnaryArithm | ParenArithm | Word;
export type ArrayExpr = Sh.ArrayExprGeneric<BaseNode, Pos, string>;
export type Assign = Sh.AssignGeneric<BaseNode, Pos, string>;

export type BinaryArithm = Sh.BinaryArithmGeneric<BaseNode, Pos, string>;
export type BinaryCmd = Sh.BinaryCmdGeneric<BaseNode, Pos, string>;
export type BinaryTest = Sh.BinaryTestGeneric<BaseNode, Pos, string>;
export type Block = Sh.BlockGeneric<BaseNode, Pos, string>;
export type CallExpr = Sh.CallExprGeneric<BaseNode, Pos, string>;
export type CaseClause = Sh.CaseClauseGeneric<BaseNode, Pos, string>;
export type CaseItem = Sh.CaseItemGeneric<BaseNode, Pos, string>;
export type CmdSubst = Sh.CmdSubstGeneric<BaseNode, Pos, string>;
export type Comment = Sh.CommentGeneric<BaseNode, Pos, string>;
export type CStyleLoop = Sh.CStyleLoopGeneric<BaseNode, Pos, string>;
export type Command =
  | CallExpr
  | IfClause
  | WhileClause
  | ForClause
  | CaseClause
  | Block
  | Subshell
  | BinaryCmd
  | FuncDecl
  | ArithmCmd
  | TestClause
  | DeclClause
  | LetClause
  | TimeClause
  | CoprocClause;
export type CoprocClause = Sh.CoprocClauseGeneric<BaseNode, Pos, string>;
export type DblQuoted = Sh.DblQuotedGeneric<BaseNode, Pos, string>;
/** syntax.LangBash only */
export type DeclClause = Sh.DeclClauseGeneric<BaseNode, Pos, string>;
export type ExtGlob = Sh.ExtGlobGeneric<BaseNode, Pos, string>;
export type File = Sh.FileGeneric<BaseNode, Pos, string> & BaseNode;
export type ForClause = Sh.ForClauseGeneric<BaseNode, Pos, string>;
export type FuncDecl = Sh.FuncDeclGeneric<BaseNode, Pos, string>;
export type IfClause = Sh.IfClauseGeneric<BaseNode, Pos, string>;
export type LetClause = Sh.LetClauseGeneric<BaseNode, Pos, string>;
export type Lit<Values extends string = string> = Sh.LitGeneric<BaseNode, Pos, number, Values>;
export type Loop = WordIter | CStyleLoop;
export type ParamExp = Sh.ParamExpGeneric<BaseNode, Pos, string>;
export type ParenArithm = Sh.ParenArithmGeneric<BaseNode, Pos, string>;
export type ParenTest = Sh.ParenTestGeneric<BaseNode, Pos, string>;
export type ProcSubst = Sh.ProcSubstGeneric<BaseNode, Pos, string>;
export type Redirect = Sh.RedirectGeneric<BaseNode, Pos, string>;
export type SglQuoted = Sh.SglQuotedGeneric<BaseNode, Pos, string>;
export type Stmt = Sh.StmtGeneric<BaseNode, Pos, string>;
export type Subshell = Sh.SubshellGeneric<BaseNode, Pos, string>;
export type TestClause = Sh.TestClauseGeneric<BaseNode, Pos, string>;
export type TimeClause = Sh.TimeClauseGeneric<BaseNode, Pos, string>;
export type TestExpr = BinaryTest | UnaryTest | ParenTest | Word;
export type UnaryArithm = Sh.UnaryArithmGeneric<BaseNode, Pos, string>;
export type UnaryTest = Sh.UnaryTestGeneric<BaseNode, Pos, string>;
export type WhileClause = Sh.WhileClauseGeneric<BaseNode, Pos, string>;
export type Word = Sh.WordGeneric<BaseNode, Pos, string>;
export type WordIter = Sh.WordIterGeneric<BaseNode, Pos, string>;
export type WordPart =
  | Lit
  | SglQuoted
  | DblQuoted
  | ParamExp
  | CmdSubst
  | ArithmExp
  | ProcSubst
  | ExtGlob;

export interface InteractiveParseResult {
  /**
   * `parser.Interactive` callback appears to
   * run synchronously. Permit null just in case.
   */
  incomplete: boolean | null;
  /** If `incomplete` is false, this is the cleaned parse. */
  parsed: null | FileWithMeta;
}

export interface FileWithMeta extends File {
  meta: BaseMeta;
}

/**
 * `mvdan-sh` receives a string and outputs a parse tree.
 * We transform it into our own format in `parse.service`.
 * Each node in our parse tree has a `meta` (see `BaseNode`).
 * By default they share the same reference, although that may change.
 *
 * It tracks contextual information:
 * - `sessionKey`: which session we are running the code in,
 *   - links the code to a table.
 *   - has value `${defaultSessionKey}` if code not run.
 * - `fd`: mapping from file descriptor to device
 */
export interface BaseMeta {
  sessionKey: string;
  pid: number;
  ppid: number;
  pgid: number;
  fd: Record<number, string>;
  stack: string[];
  /**
   * Is this a background process?
   * This should be inherited.
   */
  background?: boolean;
  /** Log extra info? */
  verbose?: boolean;
}

export const defaultSessionKey = "code-has-not-run";
export const defaultProcessKey = "code-has-not-run";
export const defaultStdInOut = "unassigned-tty";

//#endregion

//#region util

/**
 * Clone creates completely fresh tree, sharing internal refs as before.
 * In particular, every node has the same node.meta.
 */
export function cloneParsed<T extends ParsedSh>(parsed: T): T {
  return cloneWithRefs(parsed);
}

function getChildren(node: ParsedSh): ParsedSh[] {
  switch (node.type) {
    case "ArithmCmd":
      return [node.X];
    case "ArithmExp":
      return [node.X];
    case "ArrayElem":
      return [...(node.Index ? [node.Index] : []), node.Value];
    case "ArrayExpr":
      return node.Elems;
    case "Assign":
      return [
        ...(node.Array ? [node.Array] : []),
        ...(node.Index ? [node.Index] : []),
        ...(node.Value ? [node.Value] : []),
      ];
    case "BinaryArithm":
    case "BinaryCmd":
    case "BinaryTest":
      return [node.X, node.Y];
    case "Block":
      return node.Stmts;
    case "CStyleLoop":
      return [node.Cond, node.Init, node.Post];
    case "CallExpr":
      return ([] as ParsedSh[]).concat(node.Args, node.Assigns);
    case "CaseClause":
      return ([] as ParsedSh[]).concat(node.Items, node.Word);
    case "CaseItem":
      return ([] as ParsedSh[]).concat(node.Patterns, node.Stmts);
    case "CmdSubst":
      return node.Stmts;
    case "Comment":
      return [];
    case "CoprocClause":
      return [node.Stmt];
    case "DblQuoted":
      return node.Parts;
    case "DeclClause":
      return ([] as ParsedSh[]).concat(node.Args, node.Variant);
    case "ExtGlob":
      return [];
    case "File":
      return node.Stmts;
    case "ForClause":
      return [...node.Do, node.Loop];
    case "FuncDecl":
      return [node.Body, node.Name];
    case "IfClause":
      return [...node.Cond, ...node.Then, ...(node.Else ? [node.Else] : [])];
    case "LetClause":
      return node.Exprs;
    case "Lit":
      return [];
    case "ParamExp":
      return [
        ...(node.Exp?.Word ? [node.Exp.Word] : []),
        ...(node.Index ? [node.Index] : []),
        node.Param,
        ...(node.Repl ? [node.Repl.Orig] : []),
        ...(node.Repl?.With ? [node.Repl.With] : []),
        ...(node.Slice ? [node.Slice.Offset] : []),
        ...(node.Slice?.Length ? [node.Slice.Length] : []),
      ];
    case "ParenArithm":
      return [node.X];
    case "ParenTest":
      return [node.X];
    case "ProcSubst":
      return node.Stmts;
    case "Redirect":
      return [...(node.Hdoc ? [node.Hdoc] : []), ...(node.N ? [node.N] : []), node.Word];
    case "SglQuoted":
      return [];
    case "Stmt":
      return [...(node.Cmd ? [node.Cmd] : []), ...node.Redirs];
    case "Subshell":
      return node.Stmts;
    case "TestClause":
      return [node.X];
    case "TimeClause":
      return [...(node.Stmt ? [node.Stmt] : [])];
    case "UnaryArithm":
    case "UnaryTest":
      return [node.X];
    case "WhileClause":
      return node.Cond.concat(node.Do);
    case "Word":
      return node.Parts;
    case "WordIter":
      return node.Items;
    default:
      throw testNever(node, { suffix: "getChildren" });
  }
}

export function getOpts(args: string[], options?: getopts.Options) {
  /**
   * Changes e.g. -a1 to -1a (avoid short-opt-assigns)
   * Does not alter e.g. --STOP
   */
  const sortedOpts = args
    .filter((x) => x[0] === "-")
    .map((x) => (x[1] === "-" ? x : Array.from(x).sort().join("")));
  const operands = args.filter((x) => x[0] !== "-");
  return {
    opts: simplifyGetOpts(getopts(sortedOpts, options)),
    operands,
  };
}

/**
 * `getopts` handles dup options by providing an array.
 * We restrict it to the final item. We also store list
 * of extant option names as value of key `__optKeys`.
 */
function simplifyGetOpts(parsed: getopts.ParsedOptions) {
  const output = parsed as getopts.ParsedOptions & { operands: string[] };
  Object.keys(parsed).forEach((key) => {
    output.__optKeys = [];
    if (key !== "_") {
      Array.isArray(parsed[key]) && (output[key] = last(parsed[key]) as any);
      output.__optKeys.push(key);
    }
  });
  return output;
}

/** Traverse descendents including `node` itself */
export function traverseParsed(node: ParsedSh, act: (node: ParsedSh) => void) {
  act(node);
  getChildren(node).forEach((child) => traverseParsed(child, act));
}

function withParents<T extends ParsedSh>(root: T) {
  traverseParsed(root, (node) => {
    getChildren(node).forEach((child) => ((child as BaseNode).parent = node));
  });
  return root;
}

/**
 * Convert node to a FileWithMeta,
 * so it can be used to drive a process.
 */
export function wrapInFile(
  node: Stmt | CmdSubst | Subshell,
  metaOverride?: Partial<BaseMeta>
): FileWithMeta {
  return {
    type: "File",
    Stmts: node.type === "Stmt" ? [node] : node.Stmts,
    meta: Object.assign(node.meta, metaOverride),
  } as FileWithMeta;
}

/** Collect contiguous if-clauses. */
export function collectIfClauses(cmd: IfClause): IfClause[] {
  return cmd.Else ? [cmd, ...collectIfClauses(cmd.Else)] : [cmd];
}

/**
 * View "replace" as "_" i.e. last interactive non-string value
 */
export function reconstructReplParamExp(Repl: NonNullable<ParamExp["Repl"]>) {
  let origParam = "_";
  Repl.Orig.Parts.length &&
    (origParam += "/" + Repl.Orig.Parts.map((x) => (x as Lit).Value).join(""));
  Repl.With?.Parts.length &&
    (origParam += "/" + Repl.With.Parts.map((x) => (x as Lit).Value).join(""));
  return origParam;
}

//#endregion

//#region src

class srcServiceClass {
  private onOneLine = true;

  binaryCmds(cmd: BinaryCmd): BinaryCmd[] {
    const { X, Y, Op } = cmd;
    if (X.Cmd && X.Cmd.type === "BinaryCmd" && X.Cmd.Op === Op) {
      return [...this.binaryCmds(X.Cmd), cmd];
    } else if (Y.Cmd && Y.Cmd.type === "BinaryCmd" && Y.Cmd.Op === Op) {
      return [cmd, ...this.binaryCmds(Y.Cmd)];
    }
    return [cmd];
  }

  private isBackgroundNode(node: ParsedSh) {
    return node.type === "Stmt" && node.Background;
  }

  public multilineSrc = (node: ParsedSh | null) => {
    this.onOneLine = false;
    const src = this.src(node);
    this.onOneLine = true;
    return src;
  };

  private seqSrc = (nodes: ParsedSh[], trailing = false) => {
    if (this.onOneLine) {
      const srcs = [] as string[];
      nodes.forEach((c) => srcs.push(this.src(c), this.isBackgroundNode(c) ? " " : "; "));
      return (trailing ? srcs : srcs.slice(0, -1)).join("");
    }
    return nodes.map((x) => this.src(x)).join("\n");
  };

  /**
   * Given parse tree compute source code.
   * We ensure the source code has no newlines so it can be used as history.
   */
  src = (node: ParsedSh | null): string => {
    if (!node) {
      return "";
    }
    switch (node.type) {
      case "ArithmCmd":
        return `(( ${this.src(node.X)} ))`;
      case "BinaryCmd": {
        const cmds = this.binaryCmds(node);
        const stmts = [cmds[0].X].concat(cmds.map(({ Y }) => Y));
        return stmts
          .map((c) => this.src(c))
          .join(` ${node.Op}${!this.onOneLine && node.Op !== "|" ? "\n" : ""} `);
      }

      case "BinaryArithm": {
        // if (typeof node.number === 'number') return `${node.number}`;
        return [node.X, node.Y].map((c) => this.src(c)).join(`${node.Op}`);
      }
      case "UnaryArithm": {
        // if (typeof node.number === 'number') return `${node.number}`;
        return node.Post ? `${this.src(node.X)}${node.Op}` : `${node.Op}${this.src(node.X)}`;
      }
      case "ParenArithm": {
        // if (typeof node.number === 'number') return `${node.number}`;
        return `(${this.src(node.X)})`;
      }
      case "Word": {
        if (typeof node.string === "string") return node.string;
        return node.Parts.map((c) => this.src(c)).join("");
      }

      case "ArrayExpr": {
        const contents = node.Elems.map(({ Index, Value }) =>
          Index ? `[${this.src(Index)}]=${this.src(Value)}` : this.src(Value)
        );
        return `(${contents.join(" ")})`;
      }
      case "Assign": {
        if (node.Name === null) {
          return this.src(node.Value);
        }
        const varName = node.Name.Value;
        if (node.Array) {
          return `${varName}=${this.src(node.Array)}`;
        } else if (node.Index) {
          return `${varName}[${this.src(node.Index)}]${node.Append ? "+" : ""}=${this.src(
            node.Value
          )}`;
        }
        return `${varName}${node.Append ? "+" : ""}=${this.src(node.Value || null)}`;
      }

      case "Block": {
        const { Stmts } = node;
        // Handle `{ echo foo & }`
        const terminal = Stmts.length && this.isBackgroundNode(last(Stmts)!) ? "" : ";";
        if (this.onOneLine) {
          return `{ ${this.seqSrc(Stmts)}${terminal} }`;
        } else {
          const lines = this.seqSrc(Stmts).split("\n");
          lines.length === 1 && !lines[0] && lines.pop(); // Avoid single blank line
          return `{\n${lines
            .map((x) => `  ${x}`)
            .concat(node.Last.map((x) => `  #${x.Text}`))
            .join("\n")}\n}`;
        }
      }

      case "CallExpr":
        return [
          node.Assigns.map((c) => this.src(c)).join(" "),
          node.Args.map((c) => this.src(c)).join(" "),
        ]
          .filter(Boolean)
          .join(" ");

      case "Stmt": {
        let output = [
          node.Negated && "!",
          this.src(node.Cmd),
          node.Redirs.map((c) => this.src(c)).join(" "),
          node.Background && "&",
        ]
          .filter(Boolean)
          .join(" ");

        if (!this.onOneLine && node.Comments.length) {
          const before = [] as string[];
          node.Comments.forEach((x) =>
            x.Hash.Offset < node.Position.Offset
              ? before.push(`#${x.Text}`)
              : (output += ` #${x.Text}`)
          );
          output = before.concat(output).join("\n");
        }
        return output;
      }

      case "CaseClause": {
        const cases = node.Items.map(({ Patterns, Op, Stmts }) => ({
          globs: Patterns,
          terminal: Op,
          child: Stmts,
        }));
        return [
          "case",
          this.src(node.Word),
          "in",
          cases
            .flatMap(({ child, globs, terminal }) => [
              `${globs.map((g) => this.src(g)).join(" | ")})`,
              this.seqSrc(child),
              terminal,
            ])
            .join(" "),
          "esac",
        ]
          .filter(Boolean)
          .join(" ");
      }

      case "CoprocClause":
        return ["coproc", node.Name?.Value, this.src(node.Stmt)].filter(Boolean).join(" ");

      case "DeclClause":
        return [node.Variant.Value, node.Args.map((c) => this.src(c)).join(" ")]
          .filter(Boolean)
          .join(" ");

      case "ArithmExp":
        return `${
          /**
           * TODO get type below correct
           * Have (( foo )) iff parent is 'compound'
           */
          node.parent?.type === "Stmt" ? "" : "$"
        }(( ${this.src(node.X)} ))`;

      case "CmdSubst":
        return `$( ${this.seqSrc(node.Stmts)} )`;

      case "DblQuoted":
        return `"${node.Parts.map((c) => this.src(c)).join("")}"`;

      case "ExtGlob":
        return node.Pattern.Value.replace(/\n/g, ""); // ignore newlines

      // Literals inside heredocs are handled earlier
      case "Lit": {
        // const value = node.Value.replace(/\\\n/g, '');
        // if (node.parent?.type === 'DblQuoted') {
        // return value.replace(/\n/g, '"$$\'\\n\'"'); // Need $$ for literal $
        // }
        return node.Value;
      }

      // Unhandled cases are viewed as vanilla case
      case "ParamExp": {
        if (node.Exp?.Op === ":-") {
          return `\${${node.Param.Value}:-${this.src(node.Exp.Word)}}`;
        } else if (node.Repl) {
          return `\${${reconstructReplParamExp(node.Repl)}}`;
        } else {
          return `\${${node.Param.Value}}`;
        }
      }

      case "ProcSubst": {
        const dir = node.Op === "<(" ? "<" : ">";
        return `${dir}( ${this.seqSrc(node.Stmts)} )`;
      }

      case "SglQuoted": {
        // const inner = node.Value.replace(/\n/g, '\'$$\'\\n\'\'');
        const inner = node.Value;
        return `${node.Dollar ? "$" : ""}'${inner}'`;
      }

      case "FuncDecl":
        return `${node.Name.Value}() ${this.src(node.Body)}`;

      case "IfClause": {
        return collectIfClauses(node)
          .map(({ Cond, Then }, i) =>
            Cond.length
              ? `${!i ? "if" : "elif"} ${this.seqSrc(Cond)}; then ${this.seqSrc(Then)}; `
              : `else ${this.seqSrc(Then)}; `
          )
          .concat("fi")
          .join("");
      }

      case "LetClause":
        return `let ${node.Exprs.map((c) => this.src(c)).join(" ")}`;

      case "Redirect": {
        const fd = node.N ? Number(node.N.Value) : "";
        switch (node.Op) {
          case ">":
          case ">>":
            const [part] = node.Word.Parts;
            const move = part?.type === "Lit" && part.Value.endsWith("-");
            return `${fd}${node.Op}${this.src(node.Word)}${move ? "-" : ""}`;
          default:
            return "";
        }
      }

      case "File":
        return this.seqSrc(node.Stmts);

      case "Subshell":
        return `( ${node.Stmts.map((c) => this.src(c)).join("; ")} )`;

      case "TestClause":
        return `[[ ${this.src(node.X)} ]]`;

      case "BinaryTest":
        return [node.X, node.Y].map((c) => this.src(c)).join(` ${node.Op} `);
      case "UnaryTest":
        return `${node.Op} ${this.src(node.X)}`;
      case "ParenTest":
        return `(${this.src(node.X)})`;

      case "TimeClause":
        return `time ${node.PosixFormat ? "-p " : ""}${this.src(node.Stmt)}`;

      case "ForClause": {
        const { Do, Loop } = node;
        if (Loop.type === "CStyleLoop") {
          return `for (( ${this.src(Loop.Init)}; ${this.src(Loop.Cond)}; ${this.src(
            Loop.Post
          )} )); do ${this.seqSrc(Do, true)}done`;
        }
        return `for ${Loop.Name.Value} in ${Loop.Items.map((c) => this.src(c)).join(
          " "
        )}; do ${this.seqSrc(Do, true)}done`;
      }

      case "WhileClause": {
        return `${node.Until ? "until" : "while"} ${
          node.Cond.length === 1 ? `${this.src(node.Cond[0])}; ` : this.seqSrc(node.Cond, true)
        }do${
          this.onOneLine
            ? ` ${this.seqSrc(node.Do, true)}`
            : `\n${this.seqSrc(node.Do, true)
                .split("\n")
                .map((x) => `  ${x}`)
                .join("\n")}\n`
        }done`;
      }

      // Unreachable
      case "CStyleLoop":
      case "Comment":
      case "WordIter":
      case "ArrayElem":
      case "CaseItem":
        return "";

      default:
        throw testNever(node, { suffix: "src" });
    }
  };
}

export const srcService = new srcServiceClass();

//#endregion

//#region service

/**
 * Parse shell code using npm module mvdan-sh.
 */
class ParseShService {
  /** This is actually attached to parse trees, and then reset per-parse */
  private mockMeta!: BaseMeta;
  private mockPos: () => Sh.Pos;
  private cache = {} as { [src: string]: FileWithMeta };

  constructor() {
    this.mockPos = () => ({ Line: () => 1, Col: () => 1, Offset: () => 0 } as Sh.Pos);
    this.resetMockMeta();
  }

  resetMockMeta() {
    this.mockMeta = {
      sessionKey: defaultSessionKey,
      pid: -1,
      ppid: -1,
      pgid: -1,
      fd: {
        0: defaultStdInOut,
        1: defaultStdInOut,
        2: defaultStdInOut,
      },
      stack: [],
    };
  }

  /**
   * The input  `partialSrc` must come from the command line.
   * It must be `\n`-terminated.
   * It must not have a proper-prefix which is a complete command,
   * e.g. `echo foo\necho bar\n` invalid via proper-prefix `echo foo\n`.
   */
  private interactiveParse(partialSrc: string): InteractiveParseResult {
    const parser = syntax.NewParser();
    let incomplete: null | boolean = null;
    let readCount = 0;

    try {
      // Detect if code is incomplete or complete
      parser.Interactive(
        { read: () => partialSrc.slice(readCount * 1000, ++readCount * 1000) },
        () => {
          incomplete = parser.Incomplete();
          return false;
        }
      );
    } catch (e) {
      // Ignore errors due to code being partial and `read` resolving.
    }

    const parsed = incomplete ? null : this.parse(partialSrc);
    return { incomplete, parsed };
  }

  /**
   * Use npm module `mvdan-sh` to parse shell code.
   */
  parse(src: string, cache = false): FileWithMeta {
    if (src in this.cache) {
      return cloneParsed(this.cache[src]);
    }
    const parser = syntax.NewParser(
      syntax.KeepComments(true),
      // syntax.Variant(syntax.LangPOSIX)
      syntax.Variant(syntax.LangBash),
      // syntax.Variant(syntax.LangMirBSDKorn),
    );
    const parsed = parser.Parse(src, "src.sh");
    // console.log('mvdan-sh parsed', parsed);

    /**
     * Fresh `this.mockMeta` required, else other session
     * will overwrite `meta.sessionKey`.
     */
    this.resetMockMeta();
    /**
     * Clean the parse, making it serializable.
     * `this.mockMeta` will be attached to every node.
     * We also attach the parent to each child node.
     */
    const output = withParents(this.File(parsed));
    // console.log('parse meta', JSON.stringify(this.File(parsed).meta))

    return cache ? (this.cache[src] = output) : output;
  }

  tryParseBuffer(buffer: string[]) {
    // console.log('parsing shell code', buffer.slice());
    try {
      // Parser.Interactive expects terminal newline.
      const src = buffer.join("\n") + "\n";
      const { incomplete, parsed } = this.interactiveParse(src);
      // if (parsed) {
      //   console.log('parsed shell code', parsed);
      // }

      return incomplete
        ? { key: "incomplete" as "incomplete" }
        : { key: "complete" as "complete", parsed: parsed!, src };
    } catch (e) {
      console.error(e);
      return { key: "failed" as "failed", error: `${(e as any).Error()}` };
    }
  }

  /**
   * Convert to a source-code position in our format.
   * It may be invalid e.g. `CallExpr.Semicolon`.
   * This can be inferred because 1-based `Line` will equal `0`.
   */
  private pos = ({ Line, Col, Offset }: Sh.Pos): Pos => ({
    Line: Line(),
    Col: Col(),
    Offset: Offset(),
  });

  /**
   * Convert numeric operator to string.
   */
  private op(opIndex: number): string {
    const meta = this.opMetas[opIndex];
    // console.log({ opIndex, meta });
    return meta.value || meta.name;
  }

  /** Convert to our notion of base parsed node. */
  private base = ({ Pos: _, End: __ }: Sh.BaseNode): BaseNode => {
    // console.log({ Pos, End });
    return {
      // Pos: this.pos(Pos()),
      // End: this.pos(End()),
      meta: this.mockMeta, // Gets mutated
      parent: null, // Gets overwritten
    };
  };

  //#region parse-node conversions

  private ArithmCmd = ({ Pos, End, Left, Right, Unsigned, X }: Sh.ArithmCmd): ArithmCmd => ({
    ...this.base({ Pos, End }),
    type: "ArithmCmd",
    Left: this.pos(Left),
    Right: this.pos(Right),
    Unsigned,
    X: this.ArithmExpr(X),
  });

  private ArithmExp = ({
    Pos,
    End,
    Bracket,
    Left,
    Right,
    Unsigned,
    X,
  }: Sh.ArithmExp): ArithmExp => ({
    ...this.base({ Pos, End }),
    type: "ArithmExp",
    Bracket,
    Left: this.pos(Left),
    Right: this.pos(Right),
    Unsigned,
    X: this.ArithmExpr(X),
  });

  private ArrayElem = ({ Pos, End, Comments, Index, Value }: Sh.ArrayElem): ArrayElem => ({
    ...this.base({ Pos, End }),
    type: "ArrayElem",
    Comments: Comments.map(this.Comment),
    Index: Index ? this.ArithmExpr(Index) : null,
    Value: this.Word(Value),
  });

  private ArithmExpr = (node: Sh.ArithmExpr): ArithmExpr => {
    if ("Y" in node) {
      return this.BinaryArithm(node);
    } else if ("Post" in node) {
      return this.UnaryArithm(node);
    } else if ("Lparen" in node) {
      return this.ParenArithm(node);
    }
    return this.Word(node);
  };

  private ArrayExpr = ({ Pos, End, Elems, Last, Lparen, Rparen }: Sh.ArrayExpr): ArrayExpr => ({
    ...this.base({ Pos, End }),
    type: "ArrayExpr",
    Elems: Elems.map(this.ArrayElem),
    Last: Last.map(this.Comment),
    Lparen: this.pos(Lparen),
    Rparen: this.pos(Rparen),
  });

  private Assign = ({ Pos, End, Append, Array, Index, Naked, Name, Value,  }: Sh.Assign): Assign => ({
    ...this.base({ Pos, End }),
    type: "Assign",
    Append,
    Array: Array ? this.ArrayExpr(Array) : null,
    Index: Index ? this.ArithmExpr(Index) : null,
    Naked,
    Name: Name === null ? null : this.Lit(Name),
    Value: Value === null ? null : this.Word(Value),
    // declOpts: {},
  });

  private BinaryArithm = ({ Pos, End, Op, OpPos, X, Y }: Sh.BinaryArithm): BinaryArithm => ({
    ...this.base({ Pos, End }),
    type: "BinaryArithm",
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    X: this.ArithmExpr(X),
    Y: this.ArithmExpr(Y),
  });

  private BinaryCmd = ({ Pos, End, Op, OpPos, X, Y }: Sh.BinaryCmd): BinaryCmd => ({
    ...this.base({ Pos, End }),
    type: "BinaryCmd",
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    X: this.Stmt(X),
    Y: this.Stmt(Y),
  });

  private BinaryTest = ({ Pos, End, Op, OpPos, X, Y }: Sh.BinaryTest): BinaryTest => ({
    ...this.base({ Pos, End }),
    type: "BinaryTest",
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    X: this.TestExpr(X),
    Y: this.TestExpr(Y),
  });

  private Block = ({ Pos, End, Lbrace, Rbrace, Stmts, Last }: Sh.Block): Block => ({
    ...this.base({ Pos, End }),
    type: "Block",
    Lbrace: this.pos(Lbrace),
    Rbrace: this.pos(Rbrace),
    Stmts: Stmts.map((Stmt) => this.Stmt(Stmt)),
    Last: Last.map(this.Comment),
  });

  private CallExpr = ({ Pos, End, Args, Assigns }: Sh.CallExpr): CallExpr => ({
    ...this.base({ Pos, End }),
    type: "CallExpr",
    Args: Args.map(this.Word),
    Assigns: Assigns.map(this.Assign),
  });

  private CaseClause = ({
    Pos,
    End,
    Case,
    Esac,
    Items,
    Last,
    Word,
  }: Sh.CaseClause): CaseClause => ({
    ...this.base({ Pos, End }),
    type: "CaseClause",
    Case: this.pos(Case),
    Esac: this.pos(Esac),
    Items: Items.map(this.CaseItem),
    Last: Last.map(this.Comment),
    Word: this.Word(Word),
  });

  private CaseItem = ({
    Pos,
    End,
    Comments,
    Op,
    OpPos,
    Patterns,
    Stmts,
  }: Sh.CaseItem): CaseItem => ({
    ...this.base({ Pos, End }),
    type: "CaseItem",
    Comments: Comments.map(this.Comment),
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    Patterns: Patterns.map(this.Word),
    Stmts: Stmts.map((Stmt) => this.Stmt(Stmt)),
  });

  private CmdSubst = ({
    Pos,
    End,
    Left,
    ReplyVar,
    Right,
    Stmts,
    TempFile,
  }: Sh.CmdSubst): CmdSubst => ({
    ...this.base({ Pos, End }),
    type: "CmdSubst",
    Left: this.pos(Left),
    ReplyVar,
    Right: this.pos(Right),
    Stmts: Stmts.map((Stmt) => this.Stmt(Stmt)),
    TempFile,
  });

  private Comment = ({ Pos, End, Hash, Text }: Sh.Comment): Comment => ({
    ...this.base({ Pos, End }),
    type: "Comment",
    Hash: this.pos(Hash),
    Text,
  });

  private CStyleLoop = ({
    Pos,
    End,
    Cond,
    Init,
    Lparen,
    Post,
    Rparen,
  }: Sh.CStyleLoop): CStyleLoop => ({
    ...this.base({ Pos, End }),
    type: "CStyleLoop",
    Cond: this.ArithmExpr(Cond),
    Init: this.ArithmExpr(Init),
    Lparen: this.pos(Lparen),
    Post: this.ArithmExpr(Post),
    Rparen: this.pos(Rparen),
  });

  private Command = (node: Sh.Command): Command => {
    if ("Args" in node && !("Variant" in node)) {
      return this.CallExpr(node);
    } else if ("FiPos" in node) {
      return this.IfClause(node);
    } else if ("WhilePos" in node) {
      return this.WhileClause(node);
    } else if ("ForPos" in node) {
      return this.ForClause(node);
    } else if ("Case" in node) {
      return this.CaseClause(node);
    } else if ("Lbrace" in node) {
      return this.Block(node);
    } else if ("Lparen" in node) {
      return this.Subshell(node);
    } else if ("Y" in node) {
      return this.BinaryCmd(node);
    } else if ("Body" in node) {
      return this.FuncDecl(node);
    } else if ("Unsigned" in node) {
      return this.ArithmCmd(node);
    } else if ("X" in node) {
      return this.TestClause(node);
    } else if ("Variant" in node) {
      return this.DeclClause(node);
    } else if ("Let" in node) {
      return this.LetClause(node);
    } else if ("Time" in node) {
      return this.TimeClause(node);
    }
    return this.CoprocClause(node);
  };

  private CoprocClause = ({ Pos, End, Coproc, Name, Stmt }: Sh.CoprocClause): CoprocClause => ({
    ...this.base({ Pos, End }),
    type: "CoprocClause",
    Coproc: this.pos(Coproc),
    Name: Name ? this.Lit(Name) : null,
    Stmt: this.Stmt(Stmt),
  });

  private DblQuoted = ({ Pos, End, Dollar, Parts, Left, Right }: Sh.DblQuoted): DblQuoted => ({
    ...this.base({ Pos, End }),
    type: "DblQuoted",
    Dollar,
    Parts: Parts.map(this.WordPart),
    Left: this.pos(Left),
    Right: this.pos(Right),
  });

  private DeclClause = ({ Pos, End, Args, Variant }: Sh.DeclClause): DeclClause => {
    return {
      ...this.base({ Pos, End }),
      type: "DeclClause",
      Args: Args.map(this.Assign),
      Variant: this.Lit(Variant),
    };
  };

  private ExtGlob = ({ Pos, End, Op, OpPos, Pattern }: Sh.ExtGlob): ExtGlob => ({
    ...this.base({ Pos, End }),
    type: "ExtGlob",
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    Pattern: this.Lit(Pattern),
  });

  /**
   * Previously arg had functions {Pos} and {End}.
   */
  private File = ({ Name, Stmts }: Sh.File): FileWithMeta => ({
    ...this.base({ Pos: this.mockPos, End: this.mockPos }),
    type: "File",
    Name,
    Stmts: Stmts.map((x) => this.Stmt(x)),
    meta: this.mockMeta,
  });
  // ): FileWithMeta => ({
  //   ...this.base({ Pos: this.mockPos, End: this.mockPos }),
  //   type: 'File',
  //   Name,
  //   StmtList: this.StmtList(StmtList),
  //   meta: this.mockMeta,
  // });

  private ForClause = ({
    Pos,
    End,
    Do,
    DonePos,
    DoPos,
    ForPos,
    Loop,
    Select,
  }: Sh.ForClause): ForClause => ({
    ...this.base({ Pos, End }),
    type: "ForClause",
    Do: Do.map((Stmt) => this.Stmt(Stmt)),
    DonePos: this.pos(DonePos),
    DoPos: this.pos(DoPos),
    ForPos: this.pos(ForPos),
    Loop: this.Loop(Loop),
    Select,
  });

  private FuncDecl = ({ Pos, End, Body, Name, Position, RsrvWord }: Sh.FuncDecl): FuncDecl => ({
    ...this.base({ Pos, End }),
    type: "FuncDecl",
    Body: this.Stmt(Body),
    Name: this.Lit(Name),
    Position: this.pos(Position),
    RsrvWord,
  });

  private IfClause = ({
    Pos,
    End,
    Cond,
    CondLast,
    Else,
    FiPos,
    Then,
    ThenLast,
    ThenPos,
    Last,
  }: Sh.IfClause): IfClause => ({
    ...this.base({ Pos, End }),
    type: "IfClause",
    ThenPos: this.pos(ThenPos),
    FiPos: this.pos(FiPos),

    Cond: Cond.map((Stmt) => this.Stmt(Stmt)),
    CondLast: (CondLast || []).map(this.Comment),
    Then: Then.map((Stmt) => this.Stmt(Stmt)),
    ThenLast: (ThenLast || []).map(this.Comment),

    Else: Else ? this.IfClause(Else) : null,
    Last: Last.map(this.Comment),
  });

  private LetClause = ({ Pos, End, Exprs, Let }: Sh.LetClause): LetClause => ({
    ...this.base({ Pos, End }),
    type: "LetClause",
    Exprs: Exprs.map(this.ArithmExpr),
    Let: this.pos(Let),
  });

  private Lit = <Values extends string = string>({
    Pos,
    End,
    Value,
    ValueEnd,
    ValuePos,
  }: Sh.Lit): Lit<Values> => ({
    ...this.base({ Pos, End }),
    type: "Lit",
    Value: Value as Values,
    ValueEnd: this.pos(ValueEnd),
    ValuePos: this.pos(ValuePos),
  });

  private Loop = (node: Sh.Loop): Loop => {
    if ("Name" in node) {
      return this.WordIter(node);
    }
    return this.CStyleLoop(node);
  };

  private ParamExp = ({
    Pos,
    End,
    Dollar,
    Excl,
    Exp,
    Index,
    Length,
    Names,
    Param,
    Rbrace,
    Repl,
    Short,
    Slice,
    Width,
  }: Sh.ParamExp): ParamExp => ({
    ...this.base({ Pos, End }),
    type: "ParamExp",
    Dollar: this.pos(Dollar),
    Excl,
    Exp: Exp
      ? {
          type: "Expansion",
          Op: this.op(Exp.Op),
          Word: Exp.Word ? this.Word(Exp.Word) : null,
        }
      : null,
    Index: Index ? this.ArithmExpr(Index) : null,
    Length,
    Names: Names ? this.op(Names) : null,
    Param: this.Lit(Param),
    Rbrace: this.pos(Rbrace),
    Repl: Repl
      ? {
          type: "Replace",
          All: Repl.All,
          Orig: this.Word(Repl.Orig),
          With: Repl.With ? this.Word(Repl.With) : null,
        }
      : null,
    Short,
    Slice: Slice
      ? {
          type: "Slice",
          Length: Slice.Length ? this.ArithmExpr(Slice.Length) : null,
          Offset: this.ArithmExpr(Slice.Offset),
        }
      : null,
    Width,
  });

  private ParenArithm = ({ Pos, End, Lparen, Rparen, X }: Sh.ParenArithm): ParenArithm => ({
    ...this.base({ Pos, End }),
    type: "ParenArithm",
    Lparen: this.pos(Lparen),
    Rparen: this.pos(Rparen),
    X: this.ArithmExpr(X),
  });

  private ParenTest = ({ Pos, End, Lparen, Rparen, X }: Sh.ParenTest): ParenTest => ({
    ...this.base({ Pos, End }),
    type: "ParenTest",
    Lparen: this.pos(Lparen),
    Rparen: this.pos(Rparen),
    X: this.TestExpr(X),
  });

  private ProcSubst = ({ Pos, End, Op, OpPos, Rparen, Stmts }: Sh.ProcSubst): ProcSubst => ({
    ...this.base({ Pos, End }),
    type: "ProcSubst",
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    Rparen: this.pos(Rparen),
    Stmts: Stmts.map((Stmt) => this.Stmt(Stmt)),
  });

  private Redirect = ({ Pos, End, Hdoc, N, Op, OpPos, Word }: Sh.Redirect): Redirect => ({
    ...this.base({ Pos, End }),
    type: "Redirect",
    Hdoc: Hdoc ? this.Word(Hdoc) : null,
    N: N ? this.Lit(N) : null,
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    Word: this.Word(Word),
  });

  private SglQuoted = ({ Pos, End, Dollar, Left, Right, Value }: Sh.SglQuoted): SglQuoted => ({
    ...this.base({ Pos, End }),
    type: "SglQuoted",
    Dollar,
    Left: this.pos(Left),
    Right: this.pos(Right),
    Value,
  });

  private Stmt = ({
    Pos,
    End,
    Background,
    Cmd,
    Comments,
    Coprocess,
    Negated,
    Position,
    Redirs,
    Semicolon,
  }: Sh.Stmt): Stmt => ({
    ...this.base({ Pos, End }),
    type: "Stmt",
    Background,
    Cmd: Cmd ? this.Command(Cmd) : null,
    Comments: Comments.map(this.Comment),
    Coprocess,
    Negated,
    Position: this.pos(Position),
    Redirs: Redirs.map(this.Redirect),
    Semicolon: this.pos(Semicolon),
  });

  private Subshell = ({ Pos, End, Lparen, Rparen, Stmts }: Sh.Subshell): Subshell => ({
    ...this.base({ Pos, End }),
    type: "Subshell",
    Lparen: this.pos(Lparen),
    Rparen: this.pos(Rparen),
    Stmts: Stmts.map(this.Stmt),
  });

  private TestClause = ({ Pos, End, Left, Right, X }: Sh.TestClause): TestClause => ({
    ...this.base({ Pos, End }),
    type: "TestClause",
    Left: this.pos(Left),
    Right: this.pos(Right),
    X: this.TestExpr(X),
  });

  private TestExpr = (node: Sh.TestExpr): TestExpr => {
    if ("Y" in node) {
      return this.BinaryTest(node);
    } else if ("Op" in node) {
      return this.UnaryTest(node);
    } else if ("X" in node) {
      return this.ParenTest(node);
    }
    return this.Word(node);
  };

  private TimeClause = ({ Pos, End, PosixFormat, Stmt, Time }: Sh.TimeClause): TimeClause => ({
    ...this.base({ Pos, End }),
    type: "TimeClause",
    PosixFormat,
    Stmt: Stmt ? this.Stmt(Stmt) : null,
    Time: this.pos(Time),
  });

  private UnaryArithm = ({ Pos, End, Op, OpPos, Post, X }: Sh.UnaryArithm): UnaryArithm => ({
    ...this.base({ Pos, End }),
    type: "UnaryArithm",
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    Post,
    X: this.ArithmExpr(X),
  });

  private UnaryTest = ({ Pos, End, Op, OpPos, X }: Sh.UnaryTest): UnaryTest => ({
    ...this.base({ Pos, End }),
    type: "UnaryTest",
    Op: this.op(Op),
    OpPos: this.pos(OpPos),
    X: this.TestExpr(X),
  });

  private WhileClause = ({
    Pos,
    End,
    Cond,
    Do,
    DonePos,
    DoPos,
    Until,
    WhilePos,
  }: Sh.WhileClause): WhileClause => ({
    ...this.base({ Pos, End }),
    type: "WhileClause",
    Cond: Cond.map((Stmt) => this.Stmt(Stmt)),
    Do: Do.map((Stmt) => this.Stmt(Stmt)),
    DonePos: this.pos(DonePos),
    DoPos: this.pos(DoPos),
    Until,
    WhilePos: this.pos(WhilePos),
  });

  private Word = ({ Pos, End, Parts }: Sh.Word): Word => ({
    ...this.base({ Pos, End }),
    type: "Word",
    Parts: Parts.map(this.WordPart),
  });

  private WordIter = ({ Pos, End, Items, Name }: Sh.WordIter): WordIter => ({
    ...this.base({ Pos, End }),
    type: "WordIter",
    Items: Items.map(this.Word),
    Name: this.Lit(Name),
  });

  private WordPart = (node: Sh.WordPart): WordPart => {
    if ("ValuePos" in node) {
      return this.Lit(node);
    } else if ("Value" in node) {
      return this.SglQuoted(node);
    } else if ("Parts" in node) {
      return this.DblQuoted(node);
    } else if ("Slice" in node) {
      return this.ParamExp(node);
    } else if ("TempFile" in node) {
      return this.CmdSubst(node);
    } else if ("X" in node) {
      return this.ArithmExp(node);
    } else if ("Stmts" in node) {
      return this.ProcSubst(node);
    }
    return this.ExtGlob(node);
  };
  //#endregion

  /**
   * https://github.com/mvdan/sh/blob/fdf7a3fc92bd63ca6bf0231df97875b8613c0a8a/syntax/tokens.go
   */
  private readonly opMetas: {
    name: string;
    value: null | string;
  }[] = [
    { name: "illegalTok", value: null }, // 0

    { name: "_EOF", value: null },
    { name: "_Newl", value: null },
    { name: "_Lit", value: null },
    { name: "_LitWord", value: null },
    { name: "_LitRedir", value: null },

    { name: "sglQuote", value: "'" },
    { name: "dblQuote", value: '"' },
    { name: "bckQuote", value: "`" },

    { name: "and", value: "&" },
    { name: "andAnd", value: "&&" }, // 10
    { name: "orOr", value: "||" },
    { name: "or", value: "|" },
    { name: "orAnd", value: "|&" },

    { name: "dollar", value: "$" },
    { name: "dollSglQuote", value: "$'" },
    { name: "dollDblQuote", value: '$"' },
    { name: "dollBrace", value: "${" },
    { name: "dollBrack", value: "$[" },
    { name: "dollParen", value: "$(" },
    { name: "dollDblParen", value: "$((" },
    { name: "leftBrack", value: "[" },
    { name: "dblLeftBrack", value: "[[" },
    { name: "leftParen", value: "(" },
    { name: "dblLeftParen", value: "((" },

    { name: "rightBrace", value: "}" },
    { name: "rightBrack", value: "]" },
    { name: "rightParen", value: ")" },
    { name: "dblRightParen", value: "))" },
    { name: "semicolon", value: ";" },

    { name: "dblSemicolon", value: ";;" },
    { name: "semiAnd", value: ";&" },
    { name: "dblSemiAnd", value: ";;&" },
    { name: "semiOr", value: ";|" },

    { name: "exclMark", value: "!" },
    { name: "tilde", value: "~" },
    { name: "addAdd", value: "++" },
    { name: "subSub", value: "--" },
    { name: "star", value: "*" },
    { name: "power", value: "**" },
    { name: "equal", value: "==" },
    { name: "nequal", value: "!=" },
    { name: "lequal", value: "<=" },
    { name: "gequal", value: ">=" },

    { name: "addAssgn", value: "+=" },
    { name: "subAssgn", value: "-=" },
    { name: "mulAssgn", value: "*=" },
    { name: "quoAssgn", value: "/=" },
    { name: "remAssgn", value: "%=" },
    { name: "andAssgn", value: "&=" },
    { name: "orAssgn", value: "|=" },
    { name: "xorAssgn", value: "^=" },
    { name: "shlAssgn", value: "<<=" },
    { name: "shrAssgn", value: ">>=" },

    { name: "rdrOut", value: ">" },
    { name: "appOut", value: ">>" },
    { name: "rdrIn", value: "<" },
    { name: "rdrInOut", value: "<>" },
    { name: "dplIn", value: "<&" },
    { name: "dplOut", value: ">&" },
    { name: "clbOut", value: ">|" },
    { name: "hdoc", value: "<<" },
    { name: "dashHdoc", value: "<<-" },
    { name: "wordHdoc", value: "<<<" },
    { name: "rdrAll", value: "&>" },
    { name: "appAll", value: "&>>" },

    { name: "cmdIn", value: "<(" },
    { name: "cmdOut", value: ">(" },

    { name: "plus", value: "+" },
    { name: "colPlus", value: ":+" },
    { name: "minus", value: "-" },
    { name: "colMinus", value: ":-" },
    { name: "quest", value: "?" },
    { name: "colQuest", value: ":?" },
    { name: "assgn", value: "=" },
    { name: "colAssgn", value: ":=" }, // Param expansion.
    { name: "perc", value: "%" },
    { name: "dblPerc", value: "%%" }, // Param expansion.
    { name: "hash", value: "#" }, // Param expansion.
    { name: "dblHash", value: "##" }, // Param expansion.
    { name: "caret", value: "^" },
    { name: "dblCaret", value: "^^" }, // Param expansion.
    { name: "comma", value: "," },
    { name: "dblComma", value: ",," },
    { name: "at", value: "@" },
    { name: "slash", value: "/" },
    { name: "dblSlash", value: "//" },
    { name: "colon", value: ":" },

    { name: "tsExists", value: "-e" },
    { name: "tsRegFile", value: "-f" },
    { name: "tsDirect", value: "-d" },
    { name: "tsCharSp", value: "-c" },
    { name: "tsBlckSp", value: "-b" },
    { name: "tsNmPipe", value: "-p" },
    { name: "tsSocket", value: "-S" },
    { name: "tsSmbLink", value: "-L" },
    { name: "tsSticky", value: "-k" },
    { name: "tsGIDSet", value: "-g" },
    { name: "tsUIDSet", value: "-u" },
    { name: "tsGrpOwn", value: "-G" },
    { name: "tsUsrOwn", value: "-O" },
    { name: "tsModif", value: "-N" },
    { name: "tsRead", value: "-r" },
    { name: "tsWrite", value: "-w" },
    { name: "tsExec", value: "-x" },
    { name: "tsNoEmpty", value: "-s" },
    { name: "tsFdTerm", value: "-t" },
    { name: "tsEmpStr", value: "-z" },
    { name: "tsNempStr", value: "-n" },
    { name: "tsOptSet", value: "-o" },
    { name: "tsVarSet", value: "-v" },
    { name: "tsRefVar", value: "-R" },

    { name: "tsReMatch", value: "=~" },
    { name: "tsNewer", value: "-nt" },
    { name: "tsOlder", value: "-ot" },
    { name: "tsDevIno", value: "-ef" },
    { name: "tsEql", value: "-eq" },
    { name: "tsNeq", value: "-ne" },
    { name: "tsLeq", value: "-le" },
    { name: "tsGeq", value: "-ge" },
    { name: "tsLss", value: "-lt" },
    { name: "tsGtr", value: "-gt" },

    { name: "globQuest", value: "?(" },
    { name: "globStar", value: "*(" },
    { name: "globPlus", value: "+(" },
    { name: "globAt", value: "@(" },
    { name: "globExcl", value: "!(" },
  ];
}

export const parseService = new ParseShService();

export type ParseService = ParseShService;

//#endregion

export type NamedFunction = {
  /** Function name. */
  key: string;
  /** The source code of the body of the function, e.g. `{ echo foo; }` */
  src: null | string;
  node: FileWithMeta;
};
