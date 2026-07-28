import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating "back to top" button for long pages. Portal layouts scroll
 * their <main> element (not window), so this resolves the actual
 * scrollable target fresh each time — not once at mount, since on pages
 * where content loads asynchronously (Reports, Dashboard, etc.) <main>
 * often isn't tall enough to scroll yet at mount time, which previously
 * locked this onto `window` permanently and made the button a no-op on
 * exactly those pages once their content did load in.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  // The actual element that's scrolling right now — window only if
  // <main> genuinely isn't the one scrolling (rare; most pages scroll
  // inside <main>). Re-checked on every call rather than cached.
  const getScrollTarget = (): HTMLElement | Window => {
    const main = document.querySelector("main");
    return main && main.scrollHeight > main.clientHeight ? main : window;
  };

  useEffect(() => {
    const onScroll = () => {
      const target = getScrollTarget();
      const top = target instanceof Window ? window.scrollY : target.scrollTop;
      setVisible(top > 400);
    };

    // Listen on both window and <main> (if present) — whichever one is
    // actually scrolling will fire, and getScrollTarget() inside the
    // handler figures out which that is at that moment, not at mount.
    window.addEventListener("scroll", onScroll, { passive: true });
    const main = document.querySelector("main");
    main?.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      main?.removeEventListener("scroll", onScroll);
    };
  }, []);

  const onClick = () => {
    const target = getScrollTarget();
    target.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      aria-label="Back to top"
      className="print:hidden fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-navy text-white shadow-lg hover:bg-navy-light transition-all duration-200 flex items-center justify-center animate-fade-in"
    >
      <ArrowUp className="w-5 h-5" strokeWidth={2.25} />
    </button>
  );
}
