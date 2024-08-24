import { Subject, Subscription } from "rxjs";
import { deepClone, removeFirst, last } from "../service/generic";
import type * as Sh from "./parse";
import { traverseParsed } from "./parse";
import { killError } from "./util";
import useSessionStore, { ProcessMeta, ProcessStatus } from "./session.store";

export const scrollback = 200;

export enum SigEnum {
  SIGKILL = "SIGKILL",
}

//#region model

export function makeShellIo<R, W>() {
  return new shellIoClass(new shellWireClass<R>(), new shellWireClass<W>());
}

/**
 * Two ShellSubjects i.e. the man in the middle.
 * Currently only used for TTY.
 */
class shellIoClass<R, W> {
  constructor(
    /** Readers will read from here */
    public readable: shellWireClass<R>,
    /** Writers will write to here */
    public writable: shellWireClass<W>
  ) {}

  /** Register a callback to handle writes to this file */
  handleWriters(cb: (msg: W) => void) {
    this.writable.registerCallback(cb);
    return () => this.writable.unregisterCallback(cb);
  }

  /** Read from this file */
  read(cb: (msg: R) => void) {
    this.readable.registerCallback(cb);
    return () => this.readable.unregisterCallback(cb);
  }

  /** Write to this file */
  write(msg: W) {
    this.writable.write(msg);
  }

  /** Write to readers of this file */
  writeToReaders(msg: R) {
    this.readable.write(msg);
  }
}

export type ShellIo<R, W> = shellIoClass<R, W>;

/** A wire with two ends */
class shellWireClass<T> {
  private internal: Subject<T>;
  private cbToSub: Map<(msg: T) => void, Subscription>;

  constructor() {
    this.internal = new Subject();
    this.internal.subscribe();
    this.cbToSub = new Map();
  }

  registerCallback(cb: (msg: T) => void) {
    this.cbToSub.set(cb, this.internal.subscribe(cb));
  }

  unregisterCallback(cb: (msg: T) => void) {
    this.cbToSub.get(cb)?.unsubscribe();
    this.cbToSub.delete(cb);
  }

  write(msg: T) {
    this.internal.next(msg);
  }
}

/**
 * Redirect a node and its descendants e.g.
 * - `echo foo; echo bar >/dev/null; echo baz`.
 * - `echo foo; { echo bar; } >/dev/null; echo baz`.
 */
export function redirectNode(node: Sh.ParsedSh, fdUpdates: Record<number, string>) {
  const newMeta = deepClone(node.meta);
  Object.assign(newMeta.fd, fdUpdates);
  traverseParsed(node, (descendant) => (descendant.meta = newMeta));
}

export interface Device {
  /** Uid used to 'resolve' device */
  key: string;
  /**
   * Read data from device
   * - When eof is `true` we may assume no more data
   * - Can specify that exactly one item is read
   * - Can specify if data chunks are forwarded
   */
  readData: (exactlyOne?: boolean, chunks?: boolean) => Promise<ReadResult>;
  /** Write data to device. */
  writeData: (data: any) => Promise<void>;
  /** Query/inform device we have finished all writes. */
  finishedWriting: (query?: boolean) => void | undefined | boolean;
  /** Query/Inform device we have finished all reads. */
  finishedReading: (query?: boolean) => void | undefined | boolean;
}

export interface ReadResult {
  eof?: boolean;
  data?: any;
}

export async function preProcessWrite(process: ProcessMeta, device: Device) {
  if (process.status === ProcessStatus.Killed || device.finishedReading(true) === true) {
    throw killError(process);
  } else if (process.status === ProcessStatus.Suspended) {
    let cleanup: () => any;
    await new Promise<void>((resolve, reject) => {
      process.onResumes.push(resolve);
      process.cleanups.push((cleanup = () => reject(killError(process))));
    });
    removeFirst(process.cleanups, cleanup!);
  }
}

export async function preProcessRead(process: ProcessMeta, _device: Device) {
  if (process.status === ProcessStatus.Killed) {
    throw killError(process);
  } else if (process.status === ProcessStatus.Suspended) {
    let cleanup = () => {};
    await new Promise<void>((resolve, reject) => {
      process.onResumes.push(resolve);
      process.cleanups.push((cleanup = () => reject(killError(process))));
    });
    removeFirst(process.cleanups, cleanup);
  }
}

//#region data chunk
export const dataChunkKey = "__chunk__";
export function isDataChunk(data: any): data is DataChunk {
  if (data === undefined || data === null) {
    return false;
  }
  return data[dataChunkKey];
}
export function dataChunk(items: any[]): DataChunk {
  return { __chunk__: true, items };
}

export interface DataChunk<T = any> {
  [dataChunkKey]: true;
  items: T[];
}
//#endregion

//#endregion

//#region tty model

export type MessageFromXterm = RequestHistoryLine | SendLineToShell | SendKillSignalToShell;

interface RequestHistoryLine {
  key: "req-history-line";
  historyIndex: number;
}

/**
 * After the xterm receives line(s) from user,
 * it sends them to the shell using this message.
 */
interface SendLineToShell {
  key: "send-line";
  line: string;
}

interface SendKillSignalToShell {
  key: "send-kill-sig";
}

export type MessageFromShell =
  | SendXtermPrompt
  | SendXtermInfo
  | SendXtermError
  | ClearXterm
  | TtyReceivedLine
  | SendHistoryLine;

/** tty sends and sets xterm prompt */
interface SendXtermPrompt {
  key: "send-xterm-prompt";
  prompt: string;
}

export interface SendXtermInfo {
  key: "info";
  msg: string;
}

export interface SendXtermError {
  key: "error";
  msg: string;
}

/** tty clears xterm */
interface ClearXterm {
  key: "clear-xterm";
}

/** tty informs xterm it received input line */
interface TtyReceivedLine {
  key: "tty-received-line";
}

interface SendHistoryLine {
  key: "send-history-line";
  line: string;
  nextIndex: number;
}

/** `Proxy`s sent as messages should implement `msg[proxyKey] = true` */
export const proxyKey = "__proxy__";
/** `Proxy`s sent as messages should implement `msg[proxyKey] = true` */
export function isProxy(msg: any): boolean {
  return !!(msg && msg[proxyKey]);
}

//#endregion

//#region fifo device

enum FifoStatus {
  Initial,
  Connected,
  Disconnected,
}

const defaultBuffer = 10000;

/**
 * Supports exactly one writer and one reader.
 */
export class FifoDevice implements Device {
  private buffer: any[];
  private readerStatus = FifoStatus.Initial;
  private writerStatus = FifoStatus.Initial;
  /** Invoked to resume pending reader */
  private readerResolver = null as null | (() => void);
  /** Invoked to resume pending writer */
  private writerResolver = null as null | (() => void);

  constructor(public key: string, public size = defaultBuffer) {
    this.buffer = [];
  }

  public async readData(exactlyOnce?: boolean, chunks?: boolean): Promise<ReadResult> {
    this.readerStatus = this.readerStatus || FifoStatus.Connected;

    if (this.buffer.length) {
      this.writerResolver?.(); // Unblock writer
      this.writerResolver = null;

      if (exactlyOnce) {
        if (!isDataChunk(this.buffer[0])) {
          // Standard case
          return { data: this.buffer.shift() };
        } else if (chunks) {
          // Forward chunk
          return { data: this.buffer.shift() };
        } else {
          // Handle chunk
          if (this.buffer[0].items.length <= 1) {
            // returns `{ data: undefined }` for empty chunks
            return { data: this.buffer.shift()!.items[0] };
          } else {
            return { data: this.buffer[0].items.shift() };
          }
        }
      } else {
        return { data: this.buffer.shift() };
      }
    } else if (this.writerStatus === FifoStatus.Disconnected) {
      return { eof: true };
    }
    // Reader is blocked
    return new Promise<void>((resolve) => {
      this.readerResolver = resolve;
    }).then(
      // data `undefined` will be filtered by reader
      () => ({ data: undefined })
    );
  }

  public async writeData(data: any) {
    this.writerStatus = FifoStatus.Connected;
    if (this.readerStatus === FifoStatus.Disconnected) {
      this.buffer.length = 0;
      return;
    }
    this.buffer.push(data);
    this.readerResolver?.(); // Unblock reader
    this.readerResolver = null;
    if (this.buffer.length >= this.size) {
      // Writer is blocked
      return new Promise<void>((resolve) => {
        this.writerResolver = resolve;
      });
    }
  }

  public finishedReading(query?: boolean) {
    if (query === true) {
      return this.readerStatus === FifoStatus.Disconnected;
    }
    this.readerStatus = FifoStatus.Disconnected;
    this.writerResolver?.();
    this.writerResolver = null;
  }

  public finishedWriting(query?: boolean) {
    if (query === true) {
      return this.writerStatus === FifoStatus.Disconnected;
    }
    this.writerStatus = FifoStatus.Disconnected;
    this.readerResolver?.();
    this.readerResolver = null;
  }

  public readAll() {
    const contents = [] as any[];
    this.buffer.forEach((x) => {
      if (isDataChunk(x)) {
        x.items.forEach((y) => contents.push(y));
      } else {
        contents.push(x);
      }
    });
    this.buffer.length = 0;
    return contents;
  }
}

//#endregion

//#region var device

export type VarDeviceMode = "array" | "last";

export class VarDevice implements Device {
  public key: string;
  private buffer: null | any[];

  constructor(private meta: Sh.BaseMeta, private varPath: string, private mode: VarDeviceMode) {
    this.key = `${varPath}@${meta.sessionKey}(${meta.pid})`;
    this.buffer = null;
  }

  public async writeData(data: any) {
    if (this.mode === "array") {
      if (!this.buffer) {
        this.buffer = useSessionStore.api.getVarDeep(this.meta, this.varPath);
        if (!Array.isArray(this.buffer)) {
          useSessionStore.api.setVarDeep(this.meta, this.varPath, (this.buffer = []));
        }
      }
      if (data === undefined) {
        return;
      } else if (isDataChunk(data)) {
        this.buffer!.push(...data.items);
      } else {
        this.buffer!.push(data);
      }
    } else {
      if (data === undefined) {
        return;
      } else if (isDataChunk(data)) {
        useSessionStore.api.setVarDeep(this.meta, this.varPath, last(data.items));
      } else {
        useSessionStore.api.setVarDeep(this.meta, this.varPath, data);
      }
    }
  }

  public async readData(): Promise<ReadResult> {
    return { eof: true };
  }

  public finishedReading() {
    // NOOP
  }
  public finishedWriting() {
    // NOOP
  }
}

//#endregion

//#region null device

export class NullDevice implements Device {
  constructor(public key: "/dev/null") {}

  public async writeData(_data: any) {
    // NOOP
  }
  public async readData(): Promise<ReadResult> {
    return { eof: true };
  }
  public finishedReading() {
    // NOOP
  }
  public finishedWriting() {
    // NOOP
  }
}

//#endregion

//#region voice device

export class VoiceDevice implements Device {
  command: null | VoiceCommand = null;
  defaultVoice = {} as SpeechSynthesisVoice;
  readBlocked = false;
  synth: SpeechSynthesis = window.speechSynthesis;
  voices: SpeechSynthesisVoice[] = [];

  /**
   * Manually queue commands, otherwise
   * @see {SpeechSynthesis.cancel} will cancel them all.
   */
  pending = [] as (() => void)[];
  speaking = false;

  constructor(public key: "/dev/voice", defaultVoiceName = "Daniel") {
    // https://stackoverflow.com/a/52005323/2917822
    setTimeout(() => {
      this.voices = this.synth.getVoices();
      // console.log({ voices: this.voices });
      this.defaultVoice =
        this.voices.find(({ name }) => name === defaultVoiceName) ||
        this.voices.find(({ default: isDefault }) => isDefault) ||
        this.voices[0];
    }, 100);
  }

  public finishedReading() {
    // NOOP
  }
  public finishedWriting() {
    // NOOP
  }

  /**
   * Nothing to read. Behaves like /dev/null.
   */
  public async readData(): Promise<ReadResult> {
    return { eof: true };
  }

  /**
   * Writing takes a long time, due to speech.
   * Moreover we write every line before returning.
   * - `VoiceCommand` from e.g. `say foo{1..5}`
   * - `string` from e.g. `echo foo{1..5} >/dev/voice`
   */
  async writeData(input: VoiceCommand | string) {
    await this.speak((this.command = typeof input === "string" ? { text: input } : input));
    this.command = null;
  }

  private async speak(command: VoiceCommand) {
    const { text, voice } = command;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voices.find(({ name }) => name === voice) || this.defaultVoice;

    if (this.speaking) {
      await new Promise<void>((resolve) => this.pending.push(resolve));
    }

    this.speaking = true;
    await new Promise<void>((resolve, _) => {
      utterance.onend = () => setTimeout(() => resolve(), 100);
      utterance.onerror = (errorEvent) => {
        console.error(`Utterance '${text}' by '${voice}' failed.`);
        console.error(errorEvent);
        resolve();
      };
      this.synth.speak(utterance);
    });
    this.speaking = false;

    this.pending.shift()?.();
  }
}

export interface VoiceCommand {
  voice?: string;
  text: string;
}

//#endregion
