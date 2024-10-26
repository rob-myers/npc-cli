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
    ([key, fn]) => `${key}() ${
      generatorConstructorNames.includes(fn.constructor.name)
        ? wrapWithRun(fn as AsyncGeneratorFunction)
        : wrapWithMap(fn) // assume 'AsyncFunction' or 'Function'
    }`
  ).join('\n\n'),
  'game-generators.sh': Object.entries(gameGeneratorsJs).map(
    ([key, fn]) => `${key}() ${
      generatorConstructorNames.includes(fn.constructor.name)
        ? wrapWithRun(fn as AsyncGeneratorFunction)
        : wrapWithMap(fn) // assume 'AsyncFunction' or 'Function'
    }`
  ).join('\n\n'),
};

function wrapWithRun(fn: (arg: gameGeneratorsJs.RunArg) => any) {
  const fnText = `${fn}`;
  return `{\n  run '${
    fnText.slice(fnText.indexOf('('))
  }\n' "$@"\n}`;
}

function wrapWithMap(fn: (input: any, arg: gameGeneratorsJs.RunArg) => any) {
  const fnText = `${fn}`;
  return `{\n  map '${fnText}'\n}`;
}
