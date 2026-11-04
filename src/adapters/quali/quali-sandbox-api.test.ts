import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QualiSandboxApi } from "./quali-sandbox-api";

const config = {
	baseUrl: "http://mock-host:8032/api",
	username: "user",
	password: "pass",
	domain: "Global",
};
const sandbox = {
	id: "lab-1",
	name: "My Lab",
	state: "Active",
	end_time: "end",
};

describe("QualiSandboxApi", () => {
	let mock: MockAdapter;

	beforeEach(() => {
		mock = new MockAdapter(axios);
		mock.onPut("/login").reply(200, '"mock-token-123"');
	});

	afterEach(() => mock.restore());

	it("logs in and lists sandboxes", async () => {
		mock.onGet("/sandboxes").reply(200, [sandbox]);
		const reservations = await new QualiSandboxApi(config).listReservations();
		expect(reservations).toEqual([
			{ id: "lab-1", name: "My Lab", state: "Active", endTime: "end" },
		]);
	});

	it("extends a sandbox", async () => {
		mock.onPost("/sandboxes/lab-1/extend").reply(200, {});
		mock.onGet("/sandboxes/lab-1").reply(200, sandbox);
		await expect(
			new QualiSandboxApi(config).extendReservation("lab-1", 60),
		).resolves.toMatchObject({
			id: "lab-1",
		});
	});
});
