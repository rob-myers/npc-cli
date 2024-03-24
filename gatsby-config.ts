import type { GatsbyConfig } from "gatsby";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: GatsbyConfig = {
  siteMetadata: {
    title: `NPC CLI`,
    siteUrl: `https://npc-cli.netlify.app`,
  },
  // More easily incorporate content into your pages through automatic TypeScript type generation and better GraphQL IntelliSense.
  // If you use VSCode you can also use the GraphQL plugin
  // Learn more at: https://gatsby.dev/graphql-typegen
  graphqlTypegen: true,
  plugins: [
    "gatsby-plugin-emotion",
    "gatsby-plugin-mdx",
    "gatsby-plugin-fontawesome",
    {
      resolve: "gatsby-source-filesystem",
      options: {
        name: `pages`,
        path: `src/pages`,
      },
    },
    "gatsby-plugin-tsconfig-paths",
    {
      resolve: `gatsby-plugin-compile-es6-packages`,
      options: {
        modules: [`three`],
      },
    },
  ],
  flags: {
    DEV_SSR: true,
    // FAST_DEV: true,
  },
};

export default config;
