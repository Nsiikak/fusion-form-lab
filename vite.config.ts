import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fail the production build rather than ship a checkout that can't take payments.
  if (mode === "production") {
    const env = loadEnv(mode, process.cwd(), "");
    for (const key of ["VITE_PAYSTACK_PUBLIC_KEY", "VITE_API_URL"]) {
      if (!env[key]) throw new Error(`${key} must be set for production builds`);
    }
  }
  return {
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
