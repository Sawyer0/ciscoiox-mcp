import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "test/**/*.test.ts"],
		// Fake Cisco servers listen on loopback; never route them through a proxy.
		env: { NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts"],
			reporter: ["text", "json-summary", "lcov"],
			thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 },
		},
	},
});
