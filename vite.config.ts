import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // ✅ FIX #10: Ensures all routes resolve to index.html on refresh (SPA fallback)
  server: {
    historyApiFallback: true,
  },
  preview: {
    port: 5173,
  },
});
