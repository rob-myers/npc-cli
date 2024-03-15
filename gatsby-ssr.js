import React from "react";
import { cache } from "@emotion/css";
import createEmotionServer from "@emotion/server/create-instance";
import { renderToString } from "react-dom/server";

export { wrapPageElement } from "./src/components/Page";

/**
 * @param {import("gatsby").ReplaceRendererArgs} options
 */
export const replaceRenderer = ({ bodyComponent, setHeadComponents }) => {
  const { extractCritical } = createEmotionServer(cache);
  const { css, ids } = extractCritical(
    renderToString(/** @type {React.ReactElement} */ (bodyComponent))
  );

  setHeadComponents([
    <style
      key="app-styles"
      data-emotion={`css ${ids.join(" ")}`}
      dangerouslySetInnerHTML={{ __html: css }}
    />,
  ]);
};
