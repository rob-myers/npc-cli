import React from "react";

export default function Icon(props: Props) {
  return (
    <span
      className="material-icon"
      style={{
        fontSize: `${props.size ?? 1}rem`,
        background: props.bg,
        padding: props.padding,
        transform: props.rtl ? "scaleX(-1)" : undefined,
      }}
    >
      {props.name}
    </span>
  );
}

interface Props {
  name: string;
  bg?: string;
  padding?: string;
  rtl?: boolean;
  /** REM units, default `1` */
  size?: number;
}
