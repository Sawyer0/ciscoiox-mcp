import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { createQualiClient } from "./client";

// Mock the config module
vi.mock("../config", () => ({
	config: {
		QUALI_TOKEN: "mock-token",
		LAB_ID: "mock-lab-id",
		IOX_HOST: "10.10.10.10",
        IOX_USER: "root",
        IOX_PASS: "cisco123",
	},
}));

import { config } from "../config";

describe("Quali API Client", () => {
	let mock: MockAdapter;

	beforeEach(() => {
		mock = new MockAdapter(axios);
	});

	afterEach(() => {
		mock.restore();
	});

	it("should create an axios instance with the correct base URL and headers", () => {
		const client = createQualiClient();
		expect(client.defaults.baseURL).toBe("https://devnetsandbox.cisco.com/rm/api");
		// @ts-ignore - Axios headers type definition can be tricky
		expect(client.defaults.headers.Authorization).toBe(`Bearer ${config.QUALI_TOKEN}`);
	});

	it("should return the reservation details", async () => {
        const client = createQualiClient();
		const mockResponse = {
            id: config.LAB_ID,
            status: "Active",
            end_time: "2026-01-11T12:00:00Z"
        };

		mock.onGet(`/reservations/${config.LAB_ID}`).reply(200, mockResponse);

		const response = await client.get(`/reservations/${config.LAB_ID}`);
		expect(response.data).toEqual(mockResponse);
	});
});
