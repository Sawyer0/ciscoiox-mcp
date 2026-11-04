import { describe, expect, it } from "vitest";
import { FakeReservations } from "../../test/fakes/fake-reservations";
import { NotFoundError } from "../domain/errors";
import { LabService, toIsoDuration } from "./lab-service";

const now = () => new Date("2026-01-10T17:00:00Z");

describe("toIsoDuration", () => {
	it.each([
		[45, "PT45M"],
		[60, "PT1H"],
		[90, "PT1H30M"],
		[1440, "PT24H"],
	])("formats %i minutes as %s", (minutes, iso) => {
		expect(toIsoDuration(minutes)).toBe(iso);
	});

	it("rejects non-positive or fractional minutes", () => {
		expect(() => toIsoDuration(0)).toThrow(RangeError);
		expect(() => toIsoDuration(1.5)).toThrow(RangeError);
	});
});

describe("LabService", () => {
	it("prefers a Ready lab and reports minutes remaining", async () => {
		const gateway = new FakeReservations([
			{ id: "old", name: "Old", state: "Ended" },
			{ id: "boot", name: "Booting", state: "Setup" },
			{
				id: "lab-1",
				name: "IOx",
				state: "Ready",
				endTime: "2026-01-10T19:00:00Z",
			},
		]);
		const status = await new LabService(gateway, {
			now,
		}).getActiveReservation();
		expect(status).toMatchObject({ id: "lab-1", minutesRemaining: 120 });
	});

	it("falls back to a lab that is still setting up", async () => {
		const gateway = new FakeReservations([
			{ id: "boot", name: "Booting", state: "Setup" },
		]);
		await expect(
			new LabService(gateway).getActiveReservation(),
		).resolves.toMatchObject({
			id: "boot",
		});
	});

	it("uses LAB_ID when configured instead of searching", async () => {
		const gateway = new FakeReservations([
			{ id: "a", name: "A", state: "Ready" },
			{ id: "b", name: "B", state: "Ready" },
		]);
		const lab = new LabService(gateway, { labId: "b" });
		await expect(lab.getActiveReservation()).resolves.toMatchObject({
			id: "b",
		});
	});

	it("fails clearly when no lab is live", async () => {
		const lab = new LabService(
			new FakeReservations([{ id: "x", name: "X", state: "Ended" }]),
		);
		await expect(lab.getActiveReservation()).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("extends the live lab with an ISO 8601 duration", async () => {
		const gateway = new FakeReservations([
			{ id: "lab-1", name: "IOx", state: "Ready" },
		]);
		const result = await new LabService(gateway).extend(90);
		expect(gateway.extensions).toEqual([{ id: "lab-1", duration: "PT1H30M" }]);
		expect(result.remainingTime).toBe("PT1H30M");
	});

	it("never reports negative minutes for an overdue lab", async () => {
		const gateway = new FakeReservations([
			{
				id: "lab-1",
				name: "IOx",
				state: "Ready",
				endTime: "2026-01-10T16:00:00Z",
			},
		]);
		const status = await new LabService(gateway, {
			now,
		}).getActiveReservation();
		expect(status.minutesRemaining).toBe(0);
	});
});
