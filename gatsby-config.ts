import type { GatsbyConfig } from "gatsby";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: GatsbyConfig = {
  siteMetadata: {
    title: `NPC CLI`,
    siteUrl: `https://www.yourdomain.tld`,
  },
  // More easily incorporate content into your pages through automatic TypeScript type generation and better GraphQL IntelliSense.
  // If you use VSCode you can also use the GraphQL plugin
  // Learn more at: https://gatsby.dev/graphql-typegen
  graphqlTypegen: true,
  plugins: [
    "gatsby-plugin-emotion",
    `gatsby-plugin-mdx`,
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `pages`,
        path: `src/pages`,
      },
    },
    {
      resolve: `gatsby-plugin-webfonts`,
      options: {
        fonts: {
          google2: [
            {
              family: "Material Symbols Outlined",
              axes: "wght@100..500",
            },
          ],
          google: [
            // {
            //   family: "Material Icons",
            // },
            {
              family: "Roboto",
              variants: ["300", "400", "500"],
            },
            {
              family: "Open Sans",
              variants: ["300", "700"],
            },
            {
              family: "Ubuntu",
              variants: ["300", "700"],
            },
          ],
        },
      },
    },
  ],
  flags: {
    DEV_SSR: true,
    // FAST_DEV: true,
  },
};

export default config;
