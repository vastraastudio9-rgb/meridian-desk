import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

function emitIndexHtml() {
  return {
    name: "emit-index-html",
    closeBundle() {
      const out = resolve(root, "dist-static");
      const from = resolve(out, "static.html");
      const to = resolve(out, "index.html");
      if (existsSync(from)) copyFileSync(from, to);
      const fav = resolve(root, "public/favicon.svg");
      if (existsSync(fav)) copyFileSync(fav, resolve(out, "favicon.svg"));
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [tailwindcss(), viteReact(), emitIndexHtml()],
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
