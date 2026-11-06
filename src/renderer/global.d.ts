import type { ApiReels } from "@shared/api";

declare global {
  interface Window {
    reels?: ApiReels;
  }
}
export {};
