/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy:        "#0D2B55",
        "navy-dark": "#081A36",
        "navy-light":"#1A3F70",
        brand:       "#C9A227",
        "brand-light":"#E0BE4E",
        ink:         "#1A1D29",
        slate:       "#64748B",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        "blob-move": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%":      { transform: "translate(20px, -30px) scale(1.05)" },
          "66%":      { transform: "translate(-15px, 15px) scale(0.97)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-in":     "fade-in 0.5s ease-out forwards",
        "fade-in-up":  "fade-in-up 0.6s ease-out forwards",
        "scale-in":    "scale-in 0.3s ease-out forwards",
        "gradient":    "gradient-shift 8s ease infinite",
        "blob":        "blob-move 12s ease-in-out infinite",
        "shimmer":     "shimmer 2s linear infinite",
        "float":       "float 4s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(13,43,85,0.06), 0 1px 2px -1px rgba(13,43,85,0.06)",
        "card-hover": "0 12px 24px -8px rgba(13,43,85,0.15), 0 4px 8px -4px rgba(13,43,85,0.08)",
        glow: "0 0 0 1px rgba(249,115,22,0.1), 0 8px 24px -8px rgba(249,115,22,0.25)",
      },
    },
  },
  plugins: [],
};
