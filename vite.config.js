import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: path.join(projectRoot, "web"),
  publicDir: path.join(projectRoot, "public"),
  plugins: [react()],
  build: {
    outDir: path.join(projectRoot, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: ["web", "src", "public", "node_modules"].map((directory) =>
        path.join(projectRoot, directory),
      ),
    },
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
    },
  },
});
