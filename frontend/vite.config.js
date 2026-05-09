import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Merge .env files (none committed) with process.env from the host (Netlify
  // dashboard vars land here). loadEnv("", ...) returns ALL vars, then we
  // filter for VITE_*; this is more forgiving than Vite's default lookup,
  // which has bitten us on Netlify builds when process.env arrived late.
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const apiUrl = process.env.VITE_API_URL ?? fileEnv.VITE_API_URL ?? "";
  const pixelUrl =
    process.env.VITE_TRACKING_PIXEL_URL ??
    fileEnv.VITE_TRACKING_PIXEL_URL ??
    "";

  // eslint-disable-next-line no-console
  console.log("[vite] mode =", mode);
  // eslint-disable-next-line no-console
  console.log(
    "[vite] VITE_API_URL =",
    apiUrl ? apiUrl : "<EMPTY — bundle will hit the wrong origin>"
  );
  // eslint-disable-next-line no-console
  console.log(
    "[vite] VITE_TRACKING_PIXEL_URL =",
    pixelUrl ? pixelUrl : "<EMPTY>"
  );

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      open: false,
    },
    preview: {
      port: 4173,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl),
      "import.meta.env.VITE_TRACKING_PIXEL_URL": JSON.stringify(pixelUrl),
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
      css: true,
      env: {
        VITE_API_URL: "http://localhost:8000",
        VITE_TRACKING_PIXEL_URL: "http://localhost:8000/track/pixel",
      },
    },
  };
});
