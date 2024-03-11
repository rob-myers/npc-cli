import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { focusManager } from "@tanstack/react-query";

import {
  safeJsonParse,
  tryLocalStorageGet,
  tryLocalStorageSet,
  info,
} from "src/npc-cli/service/generic";
// 🔔 avoid unnecessary HMR: do not reference view-related consts
import { DEV_EXPRESS_WEBSOCKET_PORT } from "src/scripts/const";
import { queryClient } from "src/npc-cli/service/query-client";
import { isSmallView } from "./layout";

const useStore = create<State>()(
  devtools((set, get) => ({
    articleKey: null,
    articlesMeta: {},
    browserLoaded: false,
    discussMeta: {},
    mainOverlay: false,
    navOpen: false,
    viewOpen: false,

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

      initiateBrowser() {
        const cleanUps = [] as (() => void)[];

        if (process.env.NODE_ENV !== "production") {
          /**
           * Dev-only event handling:
           * - trigger component refresh on file change
           */
          const wsClient = new WebSocket(`ws://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/dev-events`);
          wsClient.onmessage = (e) => {
            info("/dev-events message:", e);
            setTimeout(() => {
              // timeout seems necessary, despite file being
              // written before message in assets-meta.js
              queryClient.refetchQueries({
                predicate({ queryKey: [queryKey] }) {
                  return queryKey === "assets-meta.json";
                },
              });
            }, 300);
          };
          cleanUps.push(() => wsClient.close());

          /**
           * In development refetch on refocus can automate changes.
           * In production, see https://github.com/TanStack/query/pull/4805.
           */
          focusManager.setEventListener((handleFocus) => {
            if (typeof window !== "undefined" && "addEventListener" in window) {
              window.addEventListener("focus", handleFocus as (e?: FocusEvent) => void, false);
              return () => {
                window.removeEventListener("focus", handleFocus as (e?: FocusEvent) => void);
                wsClient.close();
              };
            }
          });
        }

        function onGiscusMessage(message: MessageEvent) {
          if (message.origin === "https://giscus.app" && message.data.giscus?.discussion) {
            const discussion = message.data.giscus.discussion as GiscusDiscussionMeta;
            info("giscus meta", discussion);
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
        }

        window.addEventListener("message", onGiscusMessage);
        cleanUps.push(() => window.removeEventListener("message", onGiscusMessage));

        set(() => ({ browserLoaded: true }), undefined, "browser-load");

        const topLevel: Pick<State, "navOpen" | "viewOpen"> =
          safeJsonParse(tryLocalStorageGet("site-top-level") ?? "{}") ?? {};
        if (topLevel.viewOpen) {
          set(() => ({ viewOpen: topLevel.viewOpen }));
        }
        if (topLevel.navOpen && !isSmallView()) {
          set(() => ({ navOpen: topLevel.navOpen }));
        }

        return () => cleanUps.forEach((cleanup) => cleanup());
      },

      isViewClosed() {
        return !get().viewOpen;
      },

      onTerminate() {
        const { navOpen, viewOpen } = get();
        tryLocalStorageSet("site-top-level", JSON.stringify({ navOpen, viewOpen }));
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

      toggleView(next) {
        if (next === undefined) {
          const { viewOpen } = get();
          set({ viewOpen: !viewOpen }, undefined, "toggle-view");
          return !viewOpen;
        } else {
          set({ viewOpen: next }, undefined, `${next ? "open" : "close"}-view`);
          return next;
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

  mainOverlay: boolean;
  navOpen: boolean;
  viewOpen: boolean;

  api: {
    // clickToClipboard(e: React.MouseEvent): Promise<void>;
    initiate(allFm: AllFrontMatter): void;
    initiateBrowser(): () => void;
    isViewClosed(): boolean;
    onTerminate(): void;
    setArticleKey(articleKey?: string): void;
    toggleNav(next?: boolean): void;
    /** Returns next value of `viewOpen` */
    toggleView(next?: boolean): boolean;
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
