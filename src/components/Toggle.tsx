import React from "react";
import { css, cx } from "@emotion/css";
import { FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import { FontAwesomeIcon, faChevronRight } from "./Icon";

export default function Toggle({ className, flip, ...props }: React.PropsWithChildren<Props>) {
  return (
    <button {...props} className={cx("toggle", toggleCss, className)}>
      <FontAwesomeIcon icon={faChevronRight} size="1x" beat={false} flip={flip} />
    </button>
  );
}

interface Props {
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  flip?: FontAwesomeIconProps["flip"];
  style?: React.CSSProperties;
  className?: string;
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
