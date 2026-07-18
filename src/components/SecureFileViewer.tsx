import { useEffect, useState } from "react";
import { X, Loader2, ShieldAlert, Languages, ChevronDown } from "lucide-react";
import { resolveSecureUrl } from "@/lib/storage";

interface SecureFileViewerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  storedUrl: string;
  kind: "note" | "video" | "file";
  bucket?: string;
  showCloseButton?: boolean;
  onVideoPlay?: () => void;
  onMediaError?: () => void;
}

// Major languages supported by Google Translate
const TRANSLATE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "sw", label: "Kiswahili" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "de", label: "Deutsch" },
  { code: "zh-CN", label: "中文" },
];

export default function SecureFileViewer({
  open, onClose, title, storedUrl, kind, bucket = "course-materials", showCloseButton = true, onVideoPlay, onMediaError,
}: SecureFileViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setUrl(null); setSelectedLang(null); return; }
    let cancelled = false;
    setLoading(true); setError(false);
    resolveSecureUrl(bucket, storedUrl).then((signed) => {
      if (cancelled) return;
      if (signed) setUrl(signed);
      else setError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, storedUrl, bucket]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const blocked = (e.ctrlKey || e.metaKey) && ["s","p","u","c"].includes(e.key.toLowerCase());
      if (blocked) e.preventDefault();
    };
    const blockMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("keydown", onKey);
    document.addEventListener("contextmenu", blockMenu);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("contextmenu", blockMenu);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Build the Google Translate URL for the file
  // Works best for HTML/text pages; for PDFs it opens a translated view
  const getTranslateUrl = (targetLang: string) => {
    if (!url) return null;
    return `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(url)}`;
  };

  const handleTranslate = (langCode: string) => {
    setSelectedLang(langCode);
    setShowLangMenu(false);
    const translateUrl = getTranslateUrl(langCode);
    if (translateUrl) {
      window.open(translateUrl, "_blank", "noopener,noreferrer");
    }
  };

  const selectedLabel = selectedLang
    ? TRANSLATE_LANGUAGES.find(l => l.code === selectedLang)?.label
    : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div
        className="relative w-full max-w-5xl h-[85vh] bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col select-none"
        onContextMenu={e => e.preventDefault()}
      >
        {/* ── Header bar ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-black/60 backdrop-blur-sm flex-shrink-0 gap-3">
          <h3 className="text-white text-sm font-bold truncate flex-1">{title}</h3>

          {/* Google Translate button — only for non-video content */}
          {kind !== "video" && url && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowLangMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
              >
                <Languages className="w-3.5 h-3.5" strokeWidth={2} />
                {selectedLabel ?? "Translate"}
                <ChevronDown className={`w-3 h-3 transition-transform ${showLangMenu ? "rotate-180" : ""}`} strokeWidth={2.5} />
              </button>

              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 w-44 max-h-64 overflow-y-auto">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-3 py-1.5">
                    Translate to…
                  </p>
                  {TRANSLATE_LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => handleTranslate(l.code)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors
                        ${selectedLang === l.code ? "text-navy font-bold bg-navy/5" : "text-ink font-medium"}`}
                    >
                      {l.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1 px-3 pb-2">
                    <p className="text-[9px] text-gray-400 leading-tight">
                      Opens in a new tab via Google Translate. Some PDF content may not fully translate.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 relative bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" strokeWidth={2} />
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
              <ShieldAlert className="w-8 h-8" strokeWidth={1.75} />
              <p className="text-sm">Unable to load this file right now.</p>
            </div>
          )}
          {url && !error && (
            kind === "video" ? (
              <video
                src={url} controls
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                className="w-full h-full"
                onContextMenu={e => e.preventDefault()}
                onPlay={() => onVideoPlay?.()}
                onError={() => onMediaError?.()}
              />
            ) : (
              <iframe
                src={url} title={title}
                className="w-full h-full border-0 bg-white"
                onError={() => onMediaError?.()}
              />
            )
          )}
        </div>

        {/* ── Translate hint bar (shown after a language is selected) ── */}
        {selectedLabel && kind !== "video" && (
          <div className="flex-shrink-0 bg-blue-600 px-4 py-2 flex items-center gap-2">
            <Languages className="w-3.5 h-3.5 text-white flex-shrink-0" strokeWidth={2} />
            <p className="text-white text-xs font-medium flex-1">
              Opened <strong>{selectedLabel}</strong> translation in a new tab via Google Translate.
            </p>
            <button
              onClick={() => setSelectedLang(null)}
              className="text-white/60 hover:text-white flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
