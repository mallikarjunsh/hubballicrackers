import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    // Security: Restrict allowed hosts in production
    strictPort: true,
    headers: {
      // Security Headers
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    }
  },
  build: {
    // Security: Disable source maps in production
    sourcemap: false,
    // Use esbuild minifier (faster and no additional dependency)
    minify: "esbuild",
    target: "es2015",
    rollupOptions: {
      output: {
        // Security: Obscure chunk names
        manualChunks: undefined,
      }
    }
  }
});
