import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { breakpoint } from "src/components/const";

const useStore = create<State>()(
  devtools((set, get) => ({
    articleKey: null,
    articlesMeta: {},
    browserLoaded: false,
    discussMeta: {},
    navOpen: false,

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
          if (message.origin === "https://giscus.app" && message.data.giscus?.discussion) {
            const discussion = message.data.giscus.discussion as GiscusDiscussionMeta;
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

      isSmallViewport() {
        return (
          typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint})`).matches
        );
      },

      setArticleKey(articleKey) {
        set({ articleKey: articleKey ?? null }, undefined, "set-article-key");
      },

      toggleNav(next) {
        if (next === undefined) {
          set(({ navOpen }) => ({ navOpen: !navOpen }), undefined, "toggle-nav");
        } else {
          set({ navOpen: next }, undefined, `${next ? "open" : "close"}-nav`);
        }
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

  navOpen: boolean;

  api: {
    //   clickToClipboard(e: React.MouseEvent): Promise<void>;
    initiate(allFm: AllFrontMatter): void;
    initiateBrowser(): Promise<void>;
    isSmallViewport(): boolean;
    setArticleKey(articleKey?: string): void;
    toggleNav(next?: boolean): void;
    //   setTabDisabled(tabsKey: string, componentKey: string, disabled: boolean): void
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
    "CONFUSED" | "EYES" | "HEART" | "HOORAY" | "LAUGH" | "ROCKET" | "THUMBS_DOWN" | "THUMBS_UP",
    { count: number; viewerHasReacted: boolean }
  >;
  repository: { nameWithOwner: string };
  totalCommentCount: number;
  totalReplyCount: number;
  /** e.g. `"https://github.com/rob-myers/the-last-redoubt/discussions/5"` */
  url: string;
}

const useSite = Object.assign(useStore, { api: useStore.getState().api });
export default useSite;
