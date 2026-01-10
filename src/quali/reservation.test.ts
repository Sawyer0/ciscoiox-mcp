import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { getReservationStatus } from "./reservation";

// Mock config
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

describe("Quali Reservation", () => {
	let mock: MockAdapter;

	beforeEach(() => {
		mock = new MockAdapter(axios);
	});

	afterEach(() => {
		mock.restore();
	});

	it("should return the reservation status and remaining time", async () => {
		const mockResponse = {
			id: config.LAB_ID,
			status: "Active",
			end_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
		};

		mock.onGet(`https://devnetsandbox.cisco.com/rm/api/reservations/${config.LAB_ID}`).reply(200, mockResponse);

		const status = await getReservationStatus();

		expect(status.id).toBe(config.LAB_ID);
		expect(status.status).toBe("Active");
		expect(status.end_time).toBe(mockResponse.end_time);
	});
    
    it("should handle reservation not found", async () => {
        mock.onGet(`https://devnetsandbox.cisco.com/rm/api/reservations/${config.LAB_ID}`).reply(404);
        
        await expect(getReservationStatus()).rejects.toThrow();
    });
});
