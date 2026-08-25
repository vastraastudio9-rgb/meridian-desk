import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: [
      {
        find: "@/lib/agents/runtime-api",
        replacement: resolve(root, "src/lib/agents/runtime-api.stub.ts"),
      },
      {
        find: "@/lib/market/snapshot",
        replacement: resolve(root, "src/lib/market/snapshot.stub.ts"),
      },
      {
        find: "@/lib/ai/briefing",
        replacement: resolve(root, "src/lib/ai/briefing.stub.ts"),
      },
      {
        find: "@/lib/whatsapp/api",
        replacement: resolve(root, "src/lib/whatsapp/api.stub.ts"),
      },
      {
        find: "@/lib/telegram/api",
        replacement: resolve(root, "src/lib/telegram/api.stub.ts"),
      },
      {
        find: "@/lib/exchange/binance",
        replacement: resolve(root, "src/lib/exchange/binance.stub.ts"),
      },
      { find: "@", replacement: resolve(root, "src") },
    ],
  },
  build: {
    outDir: "dist-static",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, "static.html"),
    },
  },
});
