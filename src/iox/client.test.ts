import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IoxClient } from "./client";

describe("IoxClient", () => {
	let mock: MockAdapter;
	const baseUrl = "https://1.2.3.4:8443";
	const user = "admin";
	const pass = "pass";

	beforeEach(() => {
		mock = new MockAdapter(axios);
	});

	it("should be instantiable with config", () => {
		const client = new IoxClient(baseUrl, user, pass);
		expect(client).toBeInstanceOf(IoxClient);
	});

	it("should configure axios with basic auth", () => {
		const client = new IoxClient(baseUrl, user, pass);
		// @ts-expect-error - Accessing private property for testing
		expect(client.client.defaults.auth).toEqual({
			username: user,
			password: pass,
		});
		// @ts-expect-error
		expect(client.client.defaults.baseURL).toBe(`${baseUrl}/api/v1`);
	});

	it("getHealth should return true on successful response", async () => {
		const client = new IoxClient(baseUrl, user, pass);
		mock.onGet(`${baseUrl}/api/v1/info`).reply(200);

		const isHealthy = await client.getHealth();
		expect(isHealthy).toBe(true);
	});

	it("getHealth should return false on failed response", async () => {
		const client = new IoxClient(baseUrl, user, pass);
		mock.onGet(`${baseUrl}/api/v1/info`).reply(500);

		// Suppress console error for this test
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const isHealthy = await client.getHealth();
		expect(isHealthy).toBe(false);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});
