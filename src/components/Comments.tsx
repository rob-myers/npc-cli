import React from "react";
import { css, cx } from "@emotion/css";
import Giscus from "@giscus/react";
import useSite from "./site.store";
import { afterBreakpoint, discussionsUrl } from "../const";

export default function Comments(props: Props) {
  const { articleKey, commentMeta } = useSite(
    (x) => ({
      articleKey: x.articleKey,
      commentMeta: x.articleKey ? x.discussMeta[x.articleKey] : null,
    }),
    (a, b) => a.articleKey === b.articleKey && a.commentMeta === b.commentMeta
  );

  return (
    <section className={cx("comments", rootCss)}>
      <header>
        {commentMeta ? (
          <a href={commentMeta.url} target="_blank">
            View discussion on GitHub
            {/* <Icon icon="ext-link" inline small /> */}
          </a>
        ) : (
          <>
            Comment below to start a&nbsp;
            <a href={discussionsUrl} target="_blank">
              GitHub discussion
              {/* <Icon icon="ext-link" inline small /> */}
            </a>
          </>
        )}
      </header>

      {articleKey && (
        <Giscus
          id={props.id}
          repo="rob-myers/npc-cli"
          repoId="R_kgDOLDpQzw"
          category="Announcements"
          categoryId="DIC_kwDOLDpQz84Cc0CN"
          mapping="pathname" // or "specific"
          term={articleKey}
          reactionsEnabled="1"
          // Emits message with data `{ giscus: { discussion, message } }` to window
          emitMetadata="1"
          inputPosition="top"
          theme="light"
          lang="en"
          loading="lazy"
        />
      )}
    </section>
  );
}

interface Props {
  id: string;
  term: string;
}

const rootCss = css`
  min-height: 322px;

  header {
    margin-bottom: 24px;
    > a {
      cursor: pointer;
      color: var(--page-link-color);
    }
  }

  @media (min-width: ${afterBreakpoint}) {
    min-width: 400px;
  }
`;
