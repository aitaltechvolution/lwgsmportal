import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  title?: string;
  exiting?: boolean;
}

interface ToastContextValue {
  showToast: (kind: ToastKind, message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const CONFIG: Record<ToastKind, {
  Icon: typeof CheckCircle2;
  iconCls: string;
  border: string;
  titleCls: string;
  bg: string;
  progress: string;
}> = {
  success: { Icon: CheckCircle2, iconCls: "text-emerald-500", border: "border-l-[5px] border-emerald-500", titleCls: "text-emerald-700", bg: "bg-white", progress: "bg-emerald-400" },
  error:   { Icon: XCircle,      iconCls: "text-red-500",     border: "border-l-[5px] border-red-500",     titleCls: "text-red-700",     bg: "bg-white", progress: "bg-red-400"     },
  info:    { Icon: Info,         iconCls: "text-blue-500",    border: "border-l-[5px] border-blue-500",    titleCls: "text-blue-700",    bg: "bg-white", progress: "bg-blue-400"    },
  warning: { Icon: AlertTriangle,iconCls: "text-amber-500",   border: "border-l-[5px] border-amber-500",   titleCls: "text-amber-700",   bg: "bg-white", progress: "bg-amber-400"   },
};

const DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 400);
  }, []);

  const showToast = useCallback((kind: ToastKind, message: string, title?: string) => {
    const id = `t${Date.now()}${Math.random().toString(36).slice(2,5)}`;
    setToasts(p => [...p.slice(-4), { id, kind, message, title }]);
    setTimeout(() => dismiss(id), DURATION);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* 
        FIXED TO VIEWPORT — position:fixed, z-index above everything.
        Desktop: top-right. Mobile: top full-width.
      */}
      <div
        role="region"
        aria-label="Notifications"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          left: 0,
          zIndex: 2147483647,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          padding: "12px 16px",
          gap: "10px",
        }}
      >
        {toasts.map(t => {
          const { Icon, iconCls, border, titleCls, bg, progress } = CONFIG[t.kind];
          return (
            <div
              key={t.id}
              role="alert"
              aria-live="assertive"
              style={{
                pointerEvents: "all",
                width: "min(400px, calc(100vw - 32px))",
                animation: t.exiting
                  ? "toastOut 0.4s cubic-bezier(0.4,0,1,1) both"
                  : "toastIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
                willChange: "transform, opacity",
              }}
              className={`relative overflow-hidden rounded-2xl shadow-2xl ${bg} ${border} flex items-start gap-3 px-4 py-3.5`}
            >
              {/* Progress bar that drains */}
              <div
                className={`absolute bottom-0 left-0 h-[3px] ${progress} rounded-full`}
                style={{
                  animation: t.exiting ? "none" : `toastDrain ${DURATION}ms linear both`,
                  transformOrigin: "left",
                }}
              />
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconCls}`} strokeWidth={2.5} />
              <div className="flex-1 min-w-0 pr-1">
                {t.title && <p className={`text-sm font-bold leading-snug ${titleCls}`}>{t.title}</p>}
                <p className="text-sm text-gray-700 leading-snug mt-0.5">{t.message}</p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                style={{ pointerEvents: "all" }}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors mt-0.5"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { transform: translateY(-20px) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1);        opacity: 1; }
        }
        @keyframes toastOut {
          from { transform: translateX(0);      opacity: 1; }
          to   { transform: translateX(110%);   opacity: 0; }
        }
        @keyframes toastDrain {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
