export const ansi = {
  Black: "\x1b[30m",
  Blue: "\x1b[1;34m",
  Bold: "\x1b[1m",
  BoldReset: "\x1b[22m",
  BrightGreen: "\x1b[92m",
  BrightGreenBg: "\x1b[102m\x1b[30m",
  BrightYellow: "\x1b[93m",
  BrightWhite: "\x1b[97m",
  Cyan: "\x1b[96m",
  DarkGreen: "\x1b[32m",
  DarkGrey: "\x1b[90m",
  DarkGreyBg: "\x1b[100m",
  GreyBg: "\x1b[47m",
  Italic: "\x1b[3m",
  Purple: "\x1b[35m",
  Red: "\x1b[31;1m",
  Reverse: "\x1b[7m",
  ReverseReset: "\x1b[27m",
  Reset: "\x1b[0m",
  // Strikethrough: '\x1b[9m',
  Underline: "\x1b[4m",
  UnderlineReset: "\x1b[24m",
  // Warn: '\x1b[30;104m',
  // White: '\x1b[0;37m',
  White: "\x1b[37m",
};

export const EOF = Symbol.for("EOF");
