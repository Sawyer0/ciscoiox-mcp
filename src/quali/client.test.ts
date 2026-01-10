import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { QualiClient } from "./client";

// Mock config
vi.mock("../config", () => ({
	config: {
		QUALI_PORTAL_HOST: "mock-host",
        QUALI_PORTAL_PORT: 8032,
        QUALI_USER: "user",
        QUALI_PASS: "pass",
        QUALI_DOMAIN: "Global",
		LAB_ID: "mock-lab-id",
        IOX_HOST: "10.10.10.10",
        IOX_USER: "root",
        IOX_PASS: "cisco123",
	},
}));

describe("QualiClient", () => {
	let mock: MockAdapter;

	beforeEach(() => {
		mock = new MockAdapter(axios);
	});

	afterEach(() => {
		mock.restore();
	});

	it("should login and get reservation status", async () => {
        const client = new QualiClient();
        
        // Mock Login
        mock.onPut("/login").reply(200, '"mock-token-123"');
        
        // Mock Sandboxes
        mock.onGet("/sandboxes").reply(200, [
            { id: "lab-1", name: "My Lab", state: "Active", setup_start_time: "start", end_time: "end" }
        ]);

		const status = await client.getReservationStatus();
		expect(status.id).toBe("lab-1");
        expect(status.status).toBe("Active");
	});

    it("should extend reservation", async () => {
        const client = new QualiClient();
        
        // Mock Login
        mock.onPut("/login").reply(200, '"mock-token-123"');
        
        // Mock Sandboxes (needed for extend to find ID)
        mock.onGet("/sandboxes").reply(200, [
            { id: "lab-1", name: "My Lab", state: "Active", setup_start_time: "start", end_time: "end" }
        ]);
        
        // Mock Extend
        mock.onPost("/sandboxes/lab-1/extend").reply(200, {});

        await expect(client.extendReservation(60)).resolves.toContain("Extended lab lab-1");
    });
});