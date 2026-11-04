import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeCiscoServer } from "../../../test/fake-cisco/fake-cisco-server";
import { UpstreamError } from "../../domain/errors";
import { QualiSandboxApi } from "./quali-sandbox-api";

const fake = new FakeCiscoServer();
let baseUrl = "";
const READY_ID = "c1d2e3f4-0000-4000-8000-000000000002";

const api = (password = "secret") =>
	new QualiSandboxApi({ baseUrl, username: "dev", password, domain: "Global" });

beforeAll(async () => {
	baseUrl = `http://127.0.0.1:${await fake.start()}/api`;
});
afterAll(() => fake.stop());

describe("QualiSandboxApi against a fake CloudShell", () => {
	it("logs in with the token as a Basic authorization header and lists sandboxes", async () => {
		const reservations = await api().listReservations();
		expect(reservations.map((r) => r.state)).toEqual(["Ended", "Ready"]);
		const list = fake.requests.find((r) => r.path === "/api/v2/sandboxes");
		expect(list?.headers.authorization).toMatch(/^Basic tok\d+==$/);
	});

	it("reads sandbox details including start and end time", async () => {
		await expect(api().getReservation(READY_ID)).resolves.toMatchObject({
			id: READY_ID,
			state: "Ready",
			startTime: "2026-01-10T15:00:00Z",
		});
	});

	it("extends with extended_time and returns the new end time", async () => {
		const before = await api().getReservation(READY_ID);
		const after = await api().extendReservation(READY_ID, "PT30M");
		expect(
			Date.parse(after.endTime ?? "") - Date.parse(before.endTime ?? ""),
		).toBe(30 * 60_000);
		expect(after).toMatchObject({ remainingTime: "PT30M", state: "Ready" });
	});

	it("logs in again once when the token expires", async () => {
		const client = api();
		await client.listReservations();
		fake.quali.expireTokens();
		await expect(client.listReservations()).resolves.toHaveLength(2);
	});

	it("reports bad credentials as an upstream error", async () => {
		const error = await api("wrong")
			.listReservations()
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(UpstreamError);
		expect(error).toMatchObject({
			status: 401,
			message:
				"Quali CloudShell API login returned HTTP 401: Invalid credentials",
		});
	});

	it("reports an unknown sandbox with the API's message", async () => {
		await expect(api().getReservation("nope")).rejects.toThrow(
			/HTTP 404: Sandbox not found/,
		);
	});

	it("reports an unreachable portal in plain words", async () => {
		const offline = new QualiSandboxApi({
			baseUrl: "http://127.0.0.1:1/api",
			username: "dev",
			password: "secret",
			domain: "Global",
		});
		await expect(offline.listReservations()).rejects.toThrow(/unreachable/);
	});
});
