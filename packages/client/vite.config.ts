import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
