/** @type {import('@babel/core').ConfigFunction} */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    compact: true,
    plugins: ["@babel/plugin-transform-async-generator-functions"],
    presets: ["babel-preset-gatsby"],
    ignore: [
      "./src/npc-cli/sh/src/*"
    ],
  };
}
