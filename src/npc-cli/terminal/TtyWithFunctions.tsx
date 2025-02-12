import React from "react";

import utilFunctionsSh from "!!raw-loader!../sh/src/util-functions.sh";
import gameFunctionsSh from "!!raw-loader!../sh/src/game-functions.sh";

import * as utilGeneratorsJs from '../sh/src/util-generators';
import * as gameGeneratorsJs from '../sh/src/game-generators';

import Tty, { type Props } from "./Tty";

/**
 * Using a separate file permits hot-module reloading,
 * without triggering the terminal's various useEffects.
 */
export default function TtyWithFunctions(props: Omit<Props, 'functionFiles'>) {
  return (
    <Tty {...props} functionFiles={functionFiles} />
  );
}

const generatorConstructorNames = ['AsyncGeneratorFunction', 'GeneratorFunction'];

const functionFiles = {
  'util-functions.sh': utilFunctionsSh,
  'game-functions.sh': gameFunctionsSh,
  'util-generators.sh': Object.entries(utilGeneratorsJs).map(
    ([key, fn]) => jsFunctionToShellFunction(key, fn)
  ).join('\n\n'),
  'game-generators.sh': Object.entries(gameGeneratorsJs).map(
    ([key, fn]) => jsFunctionToShellFunction(key, fn)
  ).join('\n\n'),
};

function jsFunctionToShellFunction(
  functionName: string,
  fn: (
    | ((arg: gameGeneratorsJs.RunArg) => any)
    | ((input: any, arg: gameGeneratorsJs.RunArg) => any)
  ),
) {
  return `${functionName}() ${
    generatorConstructorNames.includes(fn.constructor.name)
      ? wrapWithRun(fn as AsyncGeneratorFunction)
      : fn.constructor.name === 'Function' && fn.toString().startsWith('(')
        // const foo = (..args) => bar
        ? wrapWithCall(fn as ((arg: gameGeneratorsJs.RunArg) => any))
        // assume 'AsyncFunction' or 'Function'
        : wrapWithMap(fn as ((input: any, arg: gameGeneratorsJs.RunArg) => any))
  }`;
}

function wrapWithRun(fn: (arg: gameGeneratorsJs.RunArg) => any) {
  // 🔔 support single-quotes via (a) escaping, (b) bash-syntax $'...'
  const fnText = `${fn}`.replace(/'/g, "\\'");
  return `{\n  run $'${fnText.slice(fnText.indexOf('('))}\n' "$@"\n}`;
}

function wrapWithCall(fn: (arg: gameGeneratorsJs.RunArg) => any) {
  const fnText = `${fn}`.replace(/'/g, "\\'");
  return `{\n  call $'${fnText}' "$@"\n}`;
}

function wrapWithMap(fn: (input: any, arg: gameGeneratorsJs.RunArg) => any) {
  const fnText = `${fn}`.replace(/'/g, "\\'");
  return `{\n  map $'${fnText}' "$@"\n}`;
}
