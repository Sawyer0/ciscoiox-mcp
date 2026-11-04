import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env";

const quali = {
	QUALI_PORTAL_HOST: "10.10.20.10",
	QUALI_USER: "dev",
	QUALI_PASS: "pass",
};
const iox = { IOX_HOST: "10.10.10.10", IOX_USER: "root", IOX_PASS: "cisco123" };

describe("loadConfig", () => {
	it("rejects an environment with no integration configured", () => {
		expect(() => loadConfig({})).toThrow(ConfigError);
	});

	it("applies documented defaults for both integrations", () => {
		expect(loadConfig({ ...quali, ...iox })).toEqual({
			quali: {
				baseUrl: "http://10.10.20.10:8032/api",
				username: "dev",
				password: "pass",
				domain: "Global",
			},
			iox: {
				baseUrl: "https://10.10.10.10:8443/iox/api/v2/hosting",
				username: "root",
				password: "cisco123",
				verifyTls: false,
			},
		});
	});

	it("enables only the integration whose host is set", () => {
		const config = loadConfig(iox);
		expect(config.quali).toBeUndefined();
		expect(config.iox).toBeDefined();
	});

	it("honours overrides for ports, scheme, domain, lab id and TLS", () => {
		const config = loadConfig({
			...quali,
			...iox,
			QUALI_PORTAL_PORT: "9000",
			QUALI_DOMAIN: "DevNet",
			LAB_ID: "lab-1",
			IOX_PORT: "8080",
			IOX_SCHEME: "http",
			IOX_TLS_VERIFY: "true",
		});
		expect(config.quali?.baseUrl).toBe("http://10.10.20.10:9000/api");
		expect(config.quali?.domain).toBe("DevNet");
		expect(config.quali?.labId).toBe("lab-1");
		expect(config.iox?.baseUrl).toBe(
			"http://10.10.10.10:8080/iox/api/v2/hosting",
		);
		expect(config.iox?.verifyTls).toBe(true);
	});

	it("names every missing variable of a half-configured integration", () => {
		expect(() => loadConfig({ IOX_HOST: "h" })).toThrow(
			/IOX_USER is required; IOX_PASS is required/,
		);
	});

	it("treats blank values as unset", () => {
		expect(() => loadConfig({ ...iox, QUALI_PORTAL_HOST: "" })).not.toThrow();
	});

	it("rejects an out-of-range port", () => {
		expect(() => loadConfig({ ...iox, IOX_PORT: "70000" })).toThrow(
			ConfigError,
		);
	});
});
