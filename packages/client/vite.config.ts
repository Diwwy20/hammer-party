import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // shadcn/ui + our own imports use "@/..." → src/
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true, // expose on LAN so phones can hit the dev host on game day
    port: 5180, // dedicated port (5173 is a common default — avoid clashes)
    strictPort: true,
  },
  // @hammer/shared is consumed as raw TS source; don't let esbuild pre-bundle it.
  optimizeDeps: {
    exclude: ["@hammer/shared"],
  },
});
