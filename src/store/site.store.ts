import { create } from "zustand";
import { devtools } from "zustand/middleware";

const useStore = create<State>()(
  devtools((set, get) => ({
    articleKey: null,
    articlesMeta: {},
    browserLoaded: false,
    discussMeta: {},
    api: {
      initiate({ allMdx: { edges } }) {
        const articlesMeta = {} as State["articlesMeta"];
        for (const {
          node: { frontmatter: fm },
        } of edges) {
          if (fm && fm.key) {
            articlesMeta[fm.key] = { ...fm, tags: [...(fm.tags || [])] };
          }
        }
        set({ articlesMeta }, undefined, "initiate");
      },

      async initiateBrowser() {
        window.addEventListener("message", (message) => {
          if (
            message.origin === "https://giscus.app" &&
            message.data.giscus?.discussion
          ) {
            const discussion = message.data.giscus
              .discussion as GiscusDiscussionMeta;
            console.log("giscus meta", discussion);
            const { articleKey } = get();
            if (articleKey) {
              set(
                ({ discussMeta: comments }) => ({
                  discussMeta: { ...comments, [articleKey]: discussion },
                }),
                undefined,
                "store-giscus-meta"
              );
              return true;
            }
          }
        });
        set(() => ({ browserLoaded: true }), undefined, "browser-load");
      },

      setArticleKey(articleKey) {
        set({ articleKey: articleKey ?? null }, undefined, "set-article-key");
      },
    },
  }))
);

export type State = {
  /** Key of currently viewed article */
  articleKey: null | string;
  /** Frontmatter of every article */
  articlesMeta: { [articleKey: string]: FrontMatter };
  browserLoaded: boolean;
  discussMeta: { [articleKey: string]: GiscusDiscussionMeta };

  // navOpen: boolean;
  // /** Components occurring in Tabs. */
  // component: KeyedLookup<KeyedComponent>;
  // /** <Tabs> on current page, see `useRegisterTabs` */
  // tabs: KeyedLookup<TabsState>;

  api: {
    //   clickToClipboard(e: React.MouseEvent): Promise<void>;
    initiate(allFm: AllFrontMatter): void;
    initiateBrowser(): Promise<void>;
    //   removeComponents(tabsKey: string, ...componentKeys: string[]): void;
    setArticleKey(articleKey?: string): void;
    //   setTabDisabled(tabsKey: string, componentKey: string, disabled: boolean): void
    //   toggleDarkMode(): void;
  };
};

export interface FrontMatter {
  key: string;
  date: string;
  icon: string;
  giscusTerm?: string;
  info: string;
  label: string;
  navGroup: null | number;
  next: null | string;
  path: string;
  prev: null | string;
  tags: string[];
}

export interface AllFrontMatter {
  allMdx: {
    edges: {
      node: {
        /** Values are technically possibly null */
        frontmatter: FrontMatter;
      };
    }[];
  };
  allFile: {
    iconFilenames: { node: { relativePath: string } }[];
  };
}

interface GiscusDiscussionMeta {
  id: string;
  locked: boolean;
  reactionCount: number;
  reactions: Record<
    | "CONFUSED"
    | "EYES"
    | "HEART"
    | "HOORAY"
    | "LAUGH"
    | "ROCKET"
    | "THUMBS_DOWN"
    | "THUMBS_UP",
    { count: number; viewerHasReacted: boolean }
  >;
  repository: { nameWithOwner: string };
  totalCommentCount: number;
  totalReplyCount: number;
  /** e.g. `"https://github.com/rob-myers/the-last-redoubt/discussions/5"` */
  url: string;
}

const useSiteStore = Object.assign(useStore, { api: useStore.getState().api });
export default useSiteStore;
