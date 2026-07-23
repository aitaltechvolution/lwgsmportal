import { useEffect, useState } from "react";
import { X, Loader2, ShieldAlert } from "lucide-react";
import { resolveSecureUrl } from "@/lib/storage";

interface SecureFileViewerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  storedUrl: string;
  kind: "note" | "video" | "file" | "link";
  bucket?: string;
  showCloseButton?: boolean;
  onVideoPlay?: () => void;
  onMediaError?: () => void;
}

export default function SecureFileViewer({
  open, onClose, title, storedUrl, kind, bucket = "course-materials", showCloseButton = true, onVideoPlay, onMediaError,
}: SecureFileViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setUrl(null); return; }
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
      </div>
    </div>
  );
}