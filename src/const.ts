import type { ArticleKey, ArticleMeta } from "./components/site.store";

export const afterBreakpoint = "1201px";
export const breakpoint = "1200px";

export const discussionsUrl = "https://github.com/rob-myers/npc-cli/discussions";

export const nav = {
  collapsedRem: 4,
  collapsedWidth: `${4}rem`,
  expandedRem: 15,
  expandedWidth: `${15}rem`,
  menuItemRem: 3.5,
  menuItem: `${3.5}rem`,
  titleMarginTop: `${0.5}rem`,
} as const;

export const view = {
  /** Small viewport: height; Large viewport: width */
  barSize: "4rem",
  /** Small viewport: width; Large viewport: height */
  iconSize: "3.5rem",
} as const;

export const siteTopLevelKey = "site-top-level";

export const defaultSiteTopLevelState = {
  viewOpen: true,
  navOpen: false,
}

export const allArticlesMeta: Record<ArticleKey, ArticleMeta> = {
  index: {
    key: 'index',
    date: '2024-06-30',
    info: 'Home page',
    giscusTerm: '/home',
    label: 'home',
    path: '/',
    tags: ['cli', 'web dev', 'behaviour', 'video games'],
    
  },
  "strategy-1": {
    key: 'strategy-1',
    date: '2024-02-18',
    info: 'Introduction',
    giscusTerm: '/intro',
    label: 'intro',
    path: '/intro',
    tags: ['cli', 'web dev', 'behaviour', 'video games'],
  },
};

export const zIndexSite = /** @type {const} */ ({
  mainHeader: 40,
  mainOverlay: 50,
  nav: 60,

  aboveViewerFocusOutline: 1,
});
