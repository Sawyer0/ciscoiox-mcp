import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { extendReservation } from "./extension";

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

describe("Quali Reservation Extension", () => {
	let mock: MockAdapter;

	beforeEach(() => {
		mock = new MockAdapter(axios);
	});

	afterEach(() => {
		mock.restore();
	});

	it("should successfully extend the reservation", async () => {
        const minutes = 60;
        // POST /reservations/{id}/extend
        // Body usually contains durationInMinutes or similar. 
        // Need to check specific API docs, but assuming { durationInMinutes: 60 } based on typical Quali/CloudShell APIs.
        // Or sometimes it's an action on the reservation.
        // The README just says "Extend Lab time".
        
        // I will assume a POST to /reservations/{id}/extend with { additionalMinutes: number }
        // or just PUT /reservations/{id} with new end time?
        // Let's assume POST /reservations/{id}/extend is the endpoint for this MVP.
        
		mock.onPost(`https://devnetsandbox.cisco.com/rm/api/reservations/${config.LAB_ID}/extend`).reply(200, {
            message: "Reservation extended successfully"
        });

		await expect(extendReservation(minutes)).resolves.not.toThrow();
	});

	it("should throw an error if extension fails", async () => {
        const minutes = 60;
		mock.onPost(`https://devnetsandbox.cisco.com/rm/api/reservations/${config.LAB_ID}/extend`).reply(400, {
            error: "Extension limit reached"
        });

		await expect(extendReservation(minutes)).rejects.toThrow();
	});
});
