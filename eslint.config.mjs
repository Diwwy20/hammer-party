import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.vite/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    /**
     * `tools/` are Node scripts run straight off the disk — not browser code and
     * not bundled — so they get Node's globals rather than the DOM's. Spelled out
     * rather than pulled from the `globals` package, because this is the entire
     * list these scripts use and it is not worth a dependency.
     */
    files: ["tools/**/*.mjs"],
    languageOptions: {
      globals: { Buffer: "readonly", URL: "readonly", console: "readonly", process: "readonly" },
    },
  },
);
