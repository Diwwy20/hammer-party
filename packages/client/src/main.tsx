import { createRoot } from "react-dom/client";
import { App } from "./App";

// No <StrictMode> on purpose: its double-mount would open two socket
// connections in dev. We'll revisit once connection handling is hardened.
createRoot(document.getElementById("root")!).render(<App />);
