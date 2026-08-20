import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(process.cwd());

export default defineConfig({
  root,
  publicDir: resolve(root, "public"),
  appType: "mpa",
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
