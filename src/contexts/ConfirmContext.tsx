import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AlertTriangle, Trash2, LogOut, HelpCircle } from "lucide-react";

type ConfirmTone = "default" | "danger" | "warning";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

const ICONS: Record<ConfirmTone, typeof AlertTriangle> = {
  default: HelpCircle,
  danger: Trash2,
  warning: AlertTriangle,
};

const TONE_STYLES: Record<ConfirmTone, { iconBg: string; iconColor: string; confirmBtn: string }> = {
  default: { iconBg: "bg-navy/10",   iconColor: "text-navy",     confirmBtn: "bg-navy hover:bg-navy/90" },
  danger:  { iconBg: "bg-red-100",   iconColor: "text-red-600",  confirmBtn: "bg-red-600 hover:bg-red-700" },
  warning: { iconBg: "bg-amber-100", iconColor: "text-amber-600",confirmBtn: "bg-amber-600 hover:bg-amber-700" },
};

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handle = (result: boolean) => {
    pending?.resolve(result);
    setPending(null);
  };

  const tone = pending?.tone ?? "default";
  const Icon = ICONS[tone];
  const styles = TONE_STYLES[tone];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {pending && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => handle(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${styles.iconBg}`}>
              <Icon className={`w-6 h-6 ${styles.iconColor}`} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-ink mb-1.5">{pending.title}</h3>
            <p className="text-sm text-slate leading-relaxed mb-6">{pending.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handle(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => handle(true)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${styles.confirmBtn}`}
                autoFocus
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
