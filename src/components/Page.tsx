import React from "react";
import type { WrapPageElementBrowserArgs, WrapPageElementNodeArgs } from "gatsby";

import Root from "./Root";

export function wrapPageElement({
  element,
  props,
}: WrapPageElementBrowserArgs | WrapPageElementNodeArgs) {
  return <Root {...props} element={element} />;
}
