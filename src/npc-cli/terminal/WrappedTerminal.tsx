import React from "react";
import Terminal, { Props } from "./Terminal";

import functionsSh from "!!raw-loader!../sh/functions.sh";
import * as generatorsJs from '../sh/generators';

import { error } from "../service/generic";
import useSession, { Session } from "../sh/session.store";
import { scriptLookup } from "../sh/scripts";

/**
 * We wrap `Terminal` to permit hot-reloading source code
 * without remounting it (which would restart session).
 */
export default function WrappedTerminal(props: Props) {

  const [session, setSession] = React.useState(null as null | Session);

  React.useEffect(() => {
    if (!session) {
      return;
    }
    console.log({ generatorsJs });
    // 🚧 convert into /etc/{util,game}-generators.sh via `run`
    // 🚧 permit single-quotes via escaping
    // 🚧 run `source /etc/generators.sh &` onchange
    
  }, [session, generatorsJs]);

  React.useEffect(() => {
    if (session) {
      session.etc['functions.sh'] = functionsSh;
      session.ttyShell.sourceEtcFile('functions.sh').catch(e =>
        writeError(session.key, `/etc/functions.sh: failed to run`, e)
      );
    }
  }, [session, functionsSh]);

  return (
  <Terminal
    onLoad={initializeEtc}
    onReady={setSession}
    {...props}
  />);
}

function initializeEtc(session: Session) {
  Object.assign(session.etc, {
    'functions.sh': functionsSh,
    // 🚧 generate using `generators.js` instead
    'util-1': scriptLookup['util-1'],
    'game-1': scriptLookup['game-1'],
  });
}

function writeError(sessionKey: string, message: string, origError: any) {
  useSession.api.writeMsgCleanly(sessionKey, `${message} (see console)`, { level: 'error' });
  error(message);
  console.error(origError);
}
