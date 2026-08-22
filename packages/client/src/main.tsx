import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import { App } from "./App";

// React Query enters here only for the Phase 05 leaderboard HTTP API (per the
// locked stack: no TanStack until there's a DB-backed leaderboard).
const queryClient = new QueryClient();

// No <StrictMode> on purpose: its double-mount would open two socket
// connections in dev. We'll revisit once connection handling is hardened.
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
