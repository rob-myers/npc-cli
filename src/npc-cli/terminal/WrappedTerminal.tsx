import React from "react";
import Terminal, { Props } from "./Terminal";

import * as generatorsJs from '../sh/generators';
import functionsSh from "!!raw-loader!../sh/functions.sh";

/**
 * We wrap `Terminal` to permit hot-reloading source code
 * without remounting it (which would restart session).
 */
export default function WrappedTerminal(props: Props) {

  React.useEffect(() => {
    console.log({ generatorsJs });
    // 🚧 convert into /etc/generators.sh via `run`
    // 🚧 permit single-quotes via escaping
    // 🚧 run `source /etc/generators.sh &` onchange
  }, [generatorsJs]);

  React.useEffect(() => {
    console.log({ functionsSh });
    // 🚧 store as /etc/functions.sh
    // 🚧 run `source /etc/functions.sh &` onchange
  }, [functionsSh]);

  return <Terminal {...props} />;
}
