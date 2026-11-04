import { defineConfig } from "tsup";

// Bundles src into one ESM file that plain Node 20+ can run. Runtime
// dependencies stay external and resolve from node_modules.
export default defineConfig({
	entry: { index: "src/index.ts" },
	outDir: "dist",
	format: "esm",
	platform: "node",
	target: "node20",
	banner: { js: "#!/usr/bin/env node" },
	clean: true,
	sourcemap: true,
});
