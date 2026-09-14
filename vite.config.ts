import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@features": path.resolve(__dirname, "src/features")
    }
  },
  test: {
    // src/backend is a separate npm project with its own vitest run
    // (`cd src/backend && npm test`) — without this, `npm test` here
    // also discovers and runs backend/*.test.ts files with none of the
    // backend's own working directory (so `dotenv.config()` in
    // app.ts can't find src/backend/.env), causing real backend tests
    // to time out for reasons that have nothing to do with the actual
    // backend code being broken.
    exclude: ["node_modules/**", "src/backend/**"],
  },
});







