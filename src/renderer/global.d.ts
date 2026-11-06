import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type { ApiReels } from "@shared/api";

declare global {
  interface Window {
    reels?: ApiReels;
  }
  namespace JSX {
    interface IntrinsicElements {
      "hyperframes-player": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { src?: string; width?: string | number; height?: string | number; controls?: boolean };
    }
  }
}
export {};
