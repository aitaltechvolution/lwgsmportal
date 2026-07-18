import { useEffect } from "react";

/**
 * Site-wide deterrent against copying text or saving files out of the
 * app: right-click, copy, and cut are blocked everywhere; paste is left
 * completely untouched so users can still paste into messages, forms,
 * and assignment answers. This complements the CSS `user-select: none`
 * rule in index.css (which stops selection in the first place) by also
 * catching copies triggered via keyboard shortcuts or the browser menu.
 *
 * This is a best-effort deterrent, not a security boundary — it can't
 * stop view-source, devtools, or screenshots, and isn't meant to.
 */
export function useContentProtection() {
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    const blockCopyCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Still allow copying out of form fields (e.g. a generated
      // reference number the user may want to paste elsewhere).
      if (target?.closest("input, textarea, [contenteditable='true'], .allow-select")) return;
      e.preventDefault();
    };
    const blockDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "IMG" || target.tagName === "VIDEO")) e.preventDefault();
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("copy", blockCopyCut);
    document.addEventListener("cut", blockCopyCut);
    document.addEventListener("dragstart", blockDragStart);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("copy", blockCopyCut);
      document.removeEventListener("cut", blockCopyCut);
      document.removeEventListener("dragstart", blockDragStart);
    };
  }, []);
}
