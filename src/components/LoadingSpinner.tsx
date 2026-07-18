/**
 * LWGSM Animated Loader
 * Use instead of "Loading…" text everywhere.
 * <LoadingSpinner /> — full-page centred
 * <LoadingSpinner inline /> — inline small spinner
 * <LoadingSpinner size="sm|md|lg" /> — size control
 */

interface Props {
  inline?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export default function LoadingSpinner({ inline = false, size = "md", label }: Props) {
  const sz = { sm: 20, md: 36, lg: 56 }[size];
  const stroke = { sm: 3, md: 3.5, lg: 4 }[size];
  const r = (sz / 2) - stroke;
  const circ = 2 * Math.PI * r;

  const spinner = (
    <svg
      width={sz}
      height={sz}
      viewBox={`0 0 ${sz} ${sz}`}
      fill="none"
      style={{ animation: "lwgsmSpin 0.9s linear infinite" }}
      aria-hidden
    >
      {/* Track */}
      <circle
        cx={sz / 2} cy={sz / 2} r={r}
        stroke="currentColor" strokeWidth={stroke}
        className="text-gray-200"
      />
      {/* Arc */}
      <circle
        cx={sz / 2} cy={sz / 2} r={r}
        stroke="currentColor" strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * 0.72}
        className="text-brand"
        style={{ transformOrigin: "center", animation: "lwgsmPulse 1.8s ease-in-out infinite" }}
      />
    </svg>
  );

  if (inline) return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={label ?? "Loading"}>
      {spinner}
      {label && <span className="text-sm text-slate">{label}</span>}
      <style>{KEYFRAMES}</style>
    </span>
  );

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 w-full" role="status" aria-label={label ?? "Loading"}>
      {spinner}
      {label && <p className="text-sm text-slate font-medium animate-pulse">{label}</p>}
      <style>{KEYFRAMES}</style>
    </div>
  );
}

const KEYFRAMES = `
  @keyframes lwgsmSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes lwgsmPulse {
    0%, 100% { stroke-dashoffset: ${2 * Math.PI * 14 * 0.72}; }
    50%       { stroke-dashoffset: ${2 * Math.PI * 14 * 0.1}; }
  }
`;
