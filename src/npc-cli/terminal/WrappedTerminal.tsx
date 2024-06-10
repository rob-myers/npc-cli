import React from "react";
import Terminal, { Props } from "./Terminal";

import utilFunctionsSh from "!!raw-loader!../sh/src/util-functions.sh";
import gameFunctionsSh from "!!raw-loader!../sh/src/game-functions.sh";
import * as generatorsJs from '../sh/generators';

import { error, keys } from "../service/generic";
import useSession, { Session } from "../sh/session.store";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

const functionFiles = {
  'util-functions.sh': utilFunctionsSh,
  'game-functions.sh': gameFunctionsSh,
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

  React.useEffect(() => {
    if (!state.session) {
      return;
    }
    console.log({ generatorsJs });
    // 🚧 convert into /etc/{util,game}-generators.sh using `run`
    // 🚧 permit single-quotes via escaping
    // 🚧 run `source /etc/generators.sh &` onchange
    
  }, [state.session, generatorsJs]);

  React.useEffect(() => {
    if (state.session && state.updates++) {// skip 1st
      state.sourceFuncs(state.session);
    }
  }, [state.session, utilFunctionsSh, gameFunctionsSh]);

  return <Terminal onReady={state.onReady} {...props} />;
}
