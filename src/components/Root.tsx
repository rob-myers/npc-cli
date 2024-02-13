import React from "react";
import { css } from "@emotion/css";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import {
  graphql,
  PageProps,
  useStaticQuery,
  type WrapPageElementBrowserArgs,
  type WrapPageElementNodeArgs,
} from "gatsby";
import type { AllFrontMatter, FrontMatter } from "../store/site.store";

import { queryClient } from "../js/service/query-client";
import useSiteStore from "../store/site.store";
import Nav from "./Nav";
import Viewer from "./Viewer";
import Main from "./Main";
import Comments from "./Comments";
import { breakpoint } from "./const";

export function wrapPageElement({
  element,
  props,
}: WrapPageElementBrowserArgs | WrapPageElementNodeArgs) {
  return <Root {...props} element={element} />;
}

function Root(props: Props) {
  const frontMatter = props.pageContext?.frontmatter as FrontMatter | undefined;
  const allFrontMatter = useStaticQuery(graphql`
    query {
      allMdx {
        edges {
          node {
            frontmatter {
              key
              date
              giscusTerm
              info
              label
              path
              tags
            }
          }
        }
      }
    }
  `) as AllFrontMatter;

  React.useMemo(() => {
    // clearAllBodyScrollLocks();
    useSiteStore.api.setArticleKey(frontMatter?.key);
    useSiteStore.api.initiate(allFrontMatter);
  }, [frontMatter]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={rootCss}>
        <Nav />
        <div className="main-view">
          <Main>
            <article>{props.element}</article>
            <Comments
              id="comments"
              term={frontMatter?.giscusTerm || frontMatter?.path || "fallback-discussion"}
            />
          </Main>
          <Viewer />
        </div>
      </div>
      {/* <ReactQueryDevtools
      initialIsOpen={false}
      buttonPosition="bottom-left"
    /> */}
    </QueryClientProvider>
  );
}

type Props = PageProps<Record<string, unknown>, Record<string, unknown>, unknown, object> & {
  element: React.ReactElement<any, string | React.JSXElementConstructor<any>>;
};

const rootCss = css`
  display: flex;
  flex-direction: row;
  height: 100vh;
  height: 100dvh;

  > .main-view {
    flex: 1;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  @media (max-width: ${breakpoint}) {
    > .nav {
      position: fixed;
      height: inherit; // 100dvh
      z-index: 2;
    }
    > .main-view {
      margin-left: 4rem;
      flex-direction: column;
    }
  }
`;
