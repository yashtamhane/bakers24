// @ts-check
import { defineConfig } from "astro/config";

/**
 * Internal tooling pages (the style guide) are injected only in `astro dev` and in builds made
 * with INTERNAL_PAGES=1 (used by the test suite). They live outside src/pages, so a plain
 * `npm run build` never bundles them or their reference crops.
 * @returns {import("astro").AstroIntegration}
 */
function internalPages() {
  return {
    name: "bakers24:internal-pages",
    hooks: {
      "astro:config:setup": ({ command, injectRoute }) => {
        if (command === "dev" || process.env.INTERNAL_PAGES === "1") {
          injectRoute({ pattern: "/_styleguide", entrypoint: "./src/internal/styleguide.astro" });
          // M1 headline comparison (Bodoni Moda variant of the homepage first screen).
          injectRoute({ pattern: "/_compare/hero-bodoni-moda", entrypoint: "./src/internal/hero-bodoni-moda.astro" });
        }
      },
    },
  };
}

// Static concept proposal: no adapter, no server output, no deployment target yet.
export default defineConfig({
  output: "static",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
  devToolbar: {
    enabled: false,
  },
  integrations: [internalPages()],
});
