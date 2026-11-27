// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://memoria.kyletranfaglia.top",
  // Almost every page sits behind sign-in, so render on demand by default.
  // A page can opt back into prerendering with `export const prerender = true`.
  output: "server",
  // Photos are resized on the phone and PC and served from R2, so the
  // Cloudflare Images binding isn't needed.
  adapter: cloudflare({ imageService: "passthrough" }),
  // Sign-in sessions are stored in D1 by the auth library (Phase 1), so turn
  // off Astro's default KV-backed sessions; otherwise a KV namespace is added.
  session: false,
  integrations: [react()],
  trailingSlash: "never",
  vite: {
    plugins: [tailwindcss()],
  },
});
