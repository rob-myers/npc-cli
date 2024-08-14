import React from "react";

export function Head() {
  return (
    <>
      <title>NPC CLI</title>
      <meta
          // Shrink on open mobile keyboard
          // https://www.reddit.com/r/webdev/comments/195vkgu/comment/kht2py0
          name="viewport"
          content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content"
        />
    </>
  );
}
