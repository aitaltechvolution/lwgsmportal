interface Props {
  variant?: "dark" | "light";
  className?: string;
}

/**
 * Lightweight animated gradient "shader-style" blobs for hero sections.
 * Pure CSS animation — gives a soft, moving-light aesthetic without WebGL.
 */
export default function GradientBlobs({ variant = "dark", className = "" }: Props) {
  const palette =
    variant === "dark"
      ? {
          a: "bg-amber-500/20",
          b: "bg-blue-500/10",
          c: "bg-purple-500/10",
        }
      : {
          a: "bg-amber-200/40",
          b: "bg-blue-200/30",
          c: "bg-indigo-200/30",
        };

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className={`absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl animate-blob ${palette.a}`} />
      <div className={`absolute top-1/3 -left-32 w-80 h-80 rounded-full blur-3xl animate-blob ${palette.b}`} style={{ animationDelay: "2s" }} />
      <div className={`absolute -bottom-24 right-1/4 w-72 h-72 rounded-full blur-3xl animate-blob ${palette.c}`} style={{ animationDelay: "4s" }} />
    </div>
  );
}
