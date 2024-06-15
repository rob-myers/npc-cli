import React from "react";
import Terminal, { Props } from "./Terminal";

import utilFunctionsSh from "!!raw-loader!../sh/src/util-functions.sh";
import gameFunctionsSh from "!!raw-loader!../sh/src/game-functions.sh";

import * as utilGeneratorsJs from '../sh/src/util-generators.js';
import * as gameGeneratorsJs from '../sh/src/game-generators';

import { error, keys } from "../service/generic";
import useSession, { Session } from "../sh/session.store";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

const functionFiles = {
  'util-functions.sh': utilFunctionsSh,
  'game-functions.sh': gameFunctionsSh,
  'util-generators.sh': Object.entries(utilGeneratorsJs).map(
    ([key, fn]) => `${key}() ${wrapWithRun(fn)}`
  ).join('\n\n'),
  'game-generators.sh': Object.entries(gameGeneratorsJs).map(
    ([key, fn]) => `${key}() ${wrapWithRun(fn)}`
  ).join('\n\n'),
};

/**
 * We wrap `Terminal` for "easy" hot-reloading of source code.
 */
export default function WrappedTerminal(props: Props) {

  const state = useStateRef(() => ({
    session: null as null | Session,
    updates: 0,
    async onReady(session: Session) {
      await state.sourceFuncs(session);
      state.session = session;
      update();
    },
    async sourceFuncs(session: Session) {
      Object.assign(session.etc, functionFiles);
      await Promise.all(keys(functionFiles).map(filename =>
        session.ttyShell.sourceEtcFile(filename).catch(e =>
          state.writeError(session.key, `/etc/${filename}: failed to run`, e)
        )
      ));
    },
    writeError(sessionKey: string, message: string, origError: any) {
      useSession.api.writeMsgCleanly(sessionKey, `${message} (see console)`, { level: 'error' });
      error(message);
      console.error(origError);
    },
  }));

  const update = useUpdate();

  React.useEffect(() => {// sync shell functions
    if (state.session && state.updates++) {// skip 1st
      state.sourceFuncs(state.session);
    }
  }, [state.session, utilFunctionsSh, gameFunctionsSh, utilGeneratorsJs, gameGeneratorsJs]);

  React.useEffect(() => {// sync ~/PROFILE
    if (state.session) {
      state.session.var.PROFILE = props.env.PROFILE;
    }
  }, [state.session, props.env.PROFILE]);

  return (
    <Terminal
      onReady={state.onReady}
      onUnmount={() => { state.session = null }}
      {...props}
    />
  );
}

function wrapWithRun(fn: (arg: gameGeneratorsJs.RunArg) => any) {
  const fnText = `${fn}`;
  return `{\n  run '${
    fnText.slice(fnText.indexOf('('))
  }\n' "$@"\n}`;
}
