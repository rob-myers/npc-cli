import React from "react";
import { css, cx } from "@emotion/css";
import { FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import { FontAwesomeIcon, faChevronRight } from "./Icon";

export default function Toggle(props: React.PropsWithChildren<Props>) {
  return (
    <div
      className={cx(toggleClassName, toggleCss)}
      onClick={props.onToggle}
      onKeyDown={(e) => ["Enter", " "].includes(e.key) && props.onToggle()}
      tabIndex={0}
      style={props.style}
    >
      <FontAwesomeIcon icon={faChevronRight} size="1x" beat={false} flip={props.flip} />
    </div>
  );
}

interface Props {
  onToggle(): void;
  flip?: FontAwesomeIconProps["flip"];
  style?: React.CSSProperties;
}

const toggleCss = css`
  border-radius: 50%;
  background-color: white;
  color: black;
  width: 1.8rem;
  height: 1.8rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
`;

export const toggleClassName = "toggle";
