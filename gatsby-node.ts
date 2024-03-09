import type { CreateDevServerArgs, CreateWebpackConfigArgs } from "gatsby";
import type { Configuration } from "webpack";
import type { Application } from "express";

export function onCreateWebpackConfig(opts: CreateWebpackConfigArgs) {
  console.info({ "GATSBY STAGE": opts.stage, NODE_ENV: process.env.NODE_ENV });

  const cfg: Configuration = {
    module: {
      rules: [
        // { test: /\/raw-loader.js$/, use: 'raw-loader' },
      ],
    },
    resolve: {
      alias: {},
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
