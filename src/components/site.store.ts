import { type StateCreator, create } from "zustand";
import { devtools } from "zustand/middleware";
import { focusManager } from "@tanstack/react-query";

// 🔔 avoid unnecessary HMR: do not reference view-related consts
import {
  defaultSiteTopLevelState,
  siteTopLevelKey,
  allArticlesMeta,
} from "src/const";

import {
  safeJsonParse,
  tryLocalStorageGet,
  tryLocalStorageSet,
  info,
  isDevelopment,
} from "src/npc-cli/service/generic";
import { connectDevEventsWebsocket } from "src/npc-cli/service/fetch-assets";

const initializer: StateCreator<State, [], [["zustand/devtools", never]]> = devtools((set, get) => ({
  articleKey: null,
  articlesMeta: allArticlesMeta,
  browserLoaded: false,
  discussMeta: {},
  mainOverlay: false,
  navOpen: false,
  viewOpen: false,

  api: {

    initiateBrowser() {
      const cleanUps = [] as (() => void)[];

      if (isDevelopment()) {
        connectDevEventsWebsocket();

        /**
         * In development refetch on refocus can automate changes.
         * In production, see https://github.com/TanStack/query/pull/4805.
         */
        focusManager.setEventListener((handleFocus) => {
          if (typeof window !== "undefined" && "addEventListener" in window) {
            window.addEventListener("focus", handleFocus as (e?: FocusEvent) => void, false);
            return () => {
              window.removeEventListener("focus", handleFocus as (e?: FocusEvent) => void);
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

      const topLevel: typeof defaultSiteTopLevelState =
        safeJsonParse(
          tryLocalStorageGet(siteTopLevelKey) ?? JSON.stringify(defaultSiteTopLevelState)
        ) ?? {};
      if (topLevel.viewOpen) {
        set(() => ({ viewOpen: topLevel.viewOpen }));
      }
      if (topLevel.navOpen) {
        set(() => ({ navOpen: topLevel.navOpen }));
      }

      return () => cleanUps.forEach((cleanup) => cleanup());
    },

    isViewClosed() {
      return !get().viewOpen;
    },

    onTerminate() {
      const { navOpen, viewOpen } = get();
      tryLocalStorageSet(siteTopLevelKey, JSON.stringify({ navOpen, viewOpen }));
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
}));

const useStore = create<State>()(initializer);

export type State = {
  /** Key of currently viewed article */
  articleKey: null | string;
  /** Frontmatter of every article */
  articlesMeta: typeof allArticlesMeta;
  browserLoaded: boolean;
  discussMeta: { [articleKey: string]: GiscusDiscussionMeta };

  mainOverlay: boolean;
  navOpen: boolean;
  viewOpen: boolean;

  api: {
    // clickToClipboard(e: React.MouseEvent): Promise<void>;
    initiateBrowser(): () => void;
    isViewClosed(): boolean;
    onTerminate(): void;
    setArticleKey(articleKey?: string): void;
    toggleNav(next?: boolean): void;
    /** Returns next value of `viewOpen` */
    toggleView(next?: boolean): boolean;
  };
};

export type ArticleKey = (
  | 'index'
  | 'intro'
);

export interface ArticleMeta {
  key: ArticleKey;
  date: string;
  giscusTerm?: string;
  info: string;
  label: string;
  path: string;
  tags: string[];
}

/** 🔔 In next repo we won't use frontmatter */
export interface FrontMatter {
  key: ArticleKey;
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
