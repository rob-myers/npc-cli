import React from "react";
import { css } from "@emotion/css";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import {
  graphql,
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

export function wrapPageElement({
  element,
  props,
}: WrapPageElementBrowserArgs | WrapPageElementNodeArgs) {
  const frontMatter = props.pageContext?.frontmatter as FrontMatter | undefined;

  return (
    <>
      <HooksThatBreakTopLevel frontMatter={frontMatter} />
      <QueryClientProvider client={queryClient}>
        <div className={rootCss}>
          <Nav />
          <Main>
            <article>{element}</article>
            <Comments
              id="comments"
              term={
                frontMatter?.giscusTerm ||
                frontMatter?.path ||
                "fallback-discussion"
              }
            />
          </Main>
          <Viewer />
        </div>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </>
  );
}

export const rootCss = css`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  min-height: 100vh;
`;

function HooksThatBreakTopLevel(props: { frontMatter?: FrontMatter }) {
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
    useSiteStore.api.setArticleKey(props.frontMatter?.key);
    useSiteStore.api.initiate(allFrontMatter);
  }, [props.frontMatter]);

  return null;
}
