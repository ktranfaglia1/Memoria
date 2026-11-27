import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default defineConfig([
  {
    ignores: [
      "**/dist/",
      "**/.astro/",
      "**/.wrangler/",
      "**/node_modules/",
      "**/worker-configuration.d.ts",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  astro.configs["jsx-a11y-recommended"],
  {
    files: ["**/*.{jsx,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
]);
