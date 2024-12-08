import React from "react";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

export default function ContextMenus() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {
      default: { key: 'default' },
    },
  }));

  w.c = state;

  return null;
}

/**
 * @typedef State
 * @property {{ [cmKey: string]: NPC.ContextMenuData }} lookup
 */
