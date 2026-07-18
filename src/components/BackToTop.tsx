import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating "back to top" button for long pages. Portal layouts scroll
 * their <main> element (not window), so this listens for scroll on the
 * nearest scrollable ancestor at mount time rather than assuming window.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLElement | Window | null>(null);

  useEffect(() => {
    // Find the scrollable <main> this button is rendered alongside (it's a
    // sibling of <main> inside the same flex column in PortalLayout/Layout).
    const main = document.querySelector("main");
    const el: HTMLElement | Window = main && main.scrollHeight > main.clientHeight ? main : window;
    setScrollEl(el);

    const target = main ?? window;
    const onScroll = () => {
      const top = main ? main.scrollTop : window.scrollY;
      setVisible(top > 400);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  const onClick = () => {
    if (!scrollEl) return;
    if (scrollEl instanceof Window) scrollEl.scrollTo({ top: 0, behavior: "smooth" });
    else scrollEl.scrollTo({ top: 0, behavior: "smooth" });
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
