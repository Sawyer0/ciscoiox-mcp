import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QualiClient } from "./client";

const config = {
	baseUrl: "http://mock-host:8032/api",
	username: "user",
	password: "pass",
	domain: "Global",
};

describe("QualiClient", () => {
	let mock: MockAdapter;

	beforeEach(() => {
		mock = new MockAdapter(axios);
	});

	afterEach(() => {
		mock.restore();
	});

	it("should login and get reservation status", async () => {
		const client = new QualiClient(config);

		// Mock Login
		mock.onPut("/login").reply(200, '"mock-token-123"');

		// Mock Sandboxes
		mock.onGet("/sandboxes").reply(200, [
			{
				id: "lab-1",
				name: "My Lab",
				state: "Active",
				setup_start_time: "start",
				end_time: "end",
			},
		]);

		const status = await client.getReservationStatus();
		expect(status.id).toBe("lab-1");
		expect(status.status).toBe("Active");
	});

	it("should extend reservation", async () => {
		const client = new QualiClient(config);

		// Mock Login
		mock.onPut("/login").reply(200, '"mock-token-123"');

		// Mock Sandboxes (needed for extend to find ID)
		mock.onGet("/sandboxes").reply(200, [
			{
				id: "lab-1",
				name: "My Lab",
				state: "Active",
				setup_start_time: "start",
				end_time: "end",
			},
		]);

		// Mock Extend
		mock.onPost("/sandboxes/lab-1/extend").reply(200, {});

		await expect(client.extendReservation(60)).resolves.toContain(
			"Extended lab lab-1",
		);
	});
});
