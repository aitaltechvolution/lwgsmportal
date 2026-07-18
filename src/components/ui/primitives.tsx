import { ElementType, ReactNode, useEffect } from "react";
import { X } from "lucide-react";

/* ────────────────────────────────────────────────────────────
   Badge
   ──────────────────────────────────────────────────────────── */
interface BadgeProps {
  children: ReactNode;
  color?: "orange" | "green" | "blue" | "gray" | "red" | "purple" | "yellow" | "navy";
  icon?: ElementType;
  className?: string;
}

const colorMap: Record<string, string> = {
  orange: "bg-amber-100 text-amber-700",
  green:  "bg-green-100 text-green-700",
  blue:   "bg-blue-100 text-blue-700",
  gray:   "bg-gray-100 text-gray-600",
  red:    "bg-red-100 text-red-600",
  purple: "bg-purple-100 text-purple-700",
  yellow: "bg-yellow-100 text-yellow-700",
  navy:   "bg-navy/10 text-navy",
};

export function Badge({ children, color = "gray", icon: Icon, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${colorMap[color]} ${className}`}>
      {Icon && <Icon className="w-3 h-3" strokeWidth={2.5} />}
      {children}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────
   EmptyState
   ──────────────────────────────────────────────────────────── */
interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, subtitle, action, className = "" }: EmptyStateProps) {
  const desc = description ?? subtitle;
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-gray-400" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="font-bold text-ink text-sm mb-1">{title}</h3>
      {desc && <p className="text-sm text-slate max-w-sm leading-relaxed">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Skeleton loaders
   ──────────────────────────────────────────────────────────── */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-1/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
      <div className="skeleton h-6 w-16 rounded-full flex-shrink-0" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="skeleton w-11 h-11 rounded-xl" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-3 w-1/4" />
        <div className="skeleton h-4 w-3/4" />
      </div>
      <div className="skeleton h-2 w-full rounded-full" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ProgressBar
   ──────────────────────────────────────────────────────────── */
interface ProgressBarProps {
  value: number;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({ value, size = "md", className = "" }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const height = size === "sm" ? "h-1.5" : "h-2.5";
  const color = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-yellow-400" : "bg-brand";
  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${height} ${className}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ToggleSwitch
   ──────────────────────────────────────────────────────────── */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitch({ checked, onChange, label, disabled = false, className = "" }: ToggleSwitchProps) {
  return (
    <label className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200
          ${checked ? "bg-brand" : "bg-gray-200"} ${disabled ? "" : "hover:opacity-90"}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200
            ${checked ? "translate-x-[18px]" : "translate-x-[3px]"}`}
        />
      </button>
      {label && <span className="text-sm font-semibold text-ink">{label}</span>}
    </label>
  );
}

/* ────────────────────────────────────────────────────────────
   StatCard
   ──────────────────────────────────────────────────────────── */
interface StatCardProps {
  icon: ElementType;
  label: string;
  value: number | string;
  accent?: "navy" | "blue" | "purple" | "green" | "orange" | "red" | "yellow" | "gray";
  loading?: boolean;
  className?: string;
}

const accentMap: Record<string, { bg: string; text: string }> = {
  navy:   { bg: "bg-navy/10",    text: "text-navy" },
  blue:   { bg: "bg-blue-50",    text: "text-blue-600" },
  purple: { bg: "bg-purple-50",  text: "text-purple-600" },
  green:  { bg: "bg-green-50",   text: "text-green-600" },
  orange: { bg: "bg-orange-50",  text: "text-brand" },
  red:    { bg: "bg-red-50",     text: "text-red-600" },
  yellow: { bg: "bg-yellow-50",  text: "text-yellow-600" },
  gray:   { bg: "bg-gray-100",   text: "text-gray-600" },
};

export function StatCard({ icon: Icon, label, value, accent = "navy", loading = false, className = "" }: StatCardProps) {
  const a = accentMap[accent] ?? accentMap.navy;
  return (
    <div className={`card p-5 ${className}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${a.bg}`}>
        <Icon className={`w-5 h-5 ${a.text}`} strokeWidth={2} />
      </div>
      {loading ? (
        <div className="skeleton h-7 w-14 mb-1" />
      ) : (
        <div className={`text-2xl font-black ${a.text}`}>{value}</div>
      )}
      <div className="text-xs text-slate font-medium mt-1">{label}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Modal
   ──────────────────────────────────────────────────────────── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
            <h3 className="font-bold text-ink text-base">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-ink transition-colors p-1 rounded-lg hover:bg-gray-50">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
