import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Configuration Validation", () => {
	beforeEach(() => {
		vi.resetModules();
		process.env = {};
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("should throw an error if required environment variables are missing", async () => {
		// Import the config module dynamically to trigger validation
		await expect(import("./config")).rejects.toThrow();
	});

	it("should successfully load configuration when all variables are present", async () => {
		process.env.QUALI_TOKEN = "test-token";
		process.env.IOX_HOST = "10.10.10.10";
		process.env.LAB_ID = "test-lab-id";
		process.env.IOX_USER = "root";
		process.env.IOX_PASS = "cisco123";

		const config = await import("./config");
		expect(config.config).toEqual({
			QUALI_TOKEN: "test-token",
			IOX_HOST: "10.10.10.10",
			LAB_ID: "test-lab-id",
			IOX_USER: "root",
			IOX_PASS: "cisco123",
			IOX_PORT: 8443,
		});
	});

	it("should parse IOX_PORT if provided, or default to 8443", async () => {
		process.env.QUALI_TOKEN = "test-token";
		process.env.IOX_HOST = "10.10.10.10";
		process.env.LAB_ID = "test-lab-id";
		process.env.IOX_USER = "root";
		process.env.IOX_PASS = "cisco123";
		process.env.IOX_PORT = "5000";

		const config = await import("./config");
		expect(config.config.IOX_PORT).toBe(5000);
	});
});
