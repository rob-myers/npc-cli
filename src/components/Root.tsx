import {
  graphql,
  PageProps,
  useStaticQuery,
  type WrapPageElementBrowserArgs,
  type WrapPageElementNodeArgs,
} from "gatsby";
import React from "react";
import { css } from "@emotion/css";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import type { AllFrontMatter, FrontMatter } from "../store/site.store";
import { queryClient } from "../js/service/query-client";
import { breakpoint } from "./const";

import Nav from "./Nav";
import Viewer from "./Viewer";
import Main from "./Main";
import Comments from "./Comments";
import useSite from "../store/site.store";
import useOnResize from "src/js/hooks/use-on-resize";
import { useBeforeunload } from "react-beforeunload";

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
    useSite.api.setArticleKey(frontMatter?.key);
    useSite.api.initiate(allFrontMatter);
  }, [frontMatter]);

  // Update matchMedia computations
  useOnResize();

  React.useEffect(() => void useSite.api.initiateBrowser(), []);

  useBeforeunload(() => void useSite.api.onTerminate());

  return (
    <QueryClientProvider client={queryClient}>
      <div className={rootCss} data-testid="root">
        <Nav />
        <div className={rootContentCss} data-testid="root-content">
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

  @media (max-width: ${breakpoint}) {
    // cannot move to Nav due to react-pro-sidebar api
    > aside {
      position: fixed;
      height: 100vh;
      height: 100dvh;
      z-index: 7;
    }
  }
`;

const rootContentCss = css`
  flex: 1;
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  @media (max-width: ${breakpoint}) {
    margin-left: 4rem;
    flex-direction: column;
  }
`;
