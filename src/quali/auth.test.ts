import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { createQualiClient } from "./client";

// Mock config
vi.mock("../config", () => ({
	config: {
		QUALI_TOKEN: "initial-token",
		LAB_ID: "mock-lab-id",
        IOX_HOST: "10.10.10.10",
        IOX_USER: "root",
        IOX_PASS: "cisco123",
	},
}));

import { config } from "../config";

describe("Quali Auth Interceptor", () => {
	let mock: MockAdapter;
	let client: ReturnType<typeof createQualiClient>;

	beforeEach(() => {
		mock = new MockAdapter(axios);
		// Reset client for each test if we were caching it, but here we create new
		client = createQualiClient();
	});

	afterEach(() => {
		mock.restore();
	});

	it("should throw a user-friendly error on 401 Unauthorized", async () => {
		const endpoint = "/some-endpoint";
		mock.onGet(endpoint).reply(401);

		await expect(client.get(endpoint)).rejects.toThrow("CloudShell Token Expired or Invalid");
	});
});
