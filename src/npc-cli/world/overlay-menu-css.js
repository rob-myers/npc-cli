import { css } from "@emotion/css";

export const faderOverlayCss = css`
  position: absolute;
  z-index: 4;

  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  
  background: rgba(1, 1, 1, 1);
  opacity: 1;
  transition: opacity 1s ease-in;
  &.clear {
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s ease-in;
  }
  &.faded {
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.5s ease-in;
  }
`;

export const pausedControlsCss = css`
  position: absolute;
  right: 0;
  top: 64px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 12px;

  button {
    color: #aaa;
    padding: 12px;
    background-color: #000;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    border-width: 1px 0 1px 1px;
    border-color: #555;
    font-size: 0.8rem;

    width: 100px;

    &.highlight {
      color: #0f0;
    }
  }

  transition: filter 1s;
  &:hover {
    filter: brightness(2) ;
  }
`;
