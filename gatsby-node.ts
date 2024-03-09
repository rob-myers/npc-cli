import type { CreateDevServerArgs, CreateWebpackConfigArgs } from "gatsby";
import type { Configuration } from "webpack";
import type { Application } from "express";

export function onCreateWebpackConfig(opts: CreateWebpackConfigArgs) {
  console.log({ "GATSBY STAGE": opts.stage, NODE_ENV: process.env.NODE_ENV });

  const cfg: Configuration = {
    module: {
      rules: [
        // { test: /\/raw-loader.js$/, use: 'raw-loader' },
        // /**
        //  * Fixes `yarn build` error due to npm module `canvas`.
        //  * Only need `canvas` for scripts e.g. `yarn render-layout 301`.
        //  */
        // { test: /\.node$/, use: 'null-loader' },
      ],
    },
    resolve: {
      alias: {
        // 'cheerio': false, // null-loader
        // // Force CommonJS for PixiJS
        // // https://github.com/pixijs/pixi-react/issues/452
        // 'pixi.js': path.resolve(__dirname, 'node_modules/pixi.js/dist/cjs/pixi.min.js'),
        // '@pixi/react': path.resolve(__dirname, `node_modules/@pixi/react/dist/index.cjs${process.env.NODE_ENV === 'production' ? '' : '-dev'}.js`),
        // 'pixi-viewport': path.resolve(__dirname, 'node_modules/pixi-viewport/dist/pixi_viewport.umd.cjs'),
      },
      fallback: {
        child_process: false,
        fs: false,
        path: false,
        stream: false,
        util: false,
      },
    },
  };

  opts.actions.setWebpackConfig(cfg);
}

export function onCreateDevServer(args: CreateDevServerArgs) {
  const app = args.app as Application;
  app.get("/hello", (req, res) => res.json({ greetings: "human" }));
}
