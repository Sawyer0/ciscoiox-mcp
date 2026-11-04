import { describe, expect, it } from "vitest";
import { FakeReservations } from "../../test/fakes/fake-reservations";
import { NotFoundError } from "../domain/errors";
import { LabService } from "./lab-service";

describe("LabService", () => {
	it("returns the active reservation", async () => {
		const gateway = new FakeReservations([
			{ id: "old", name: "Old", state: "Ended" },
			{ id: "lab-1", name: "IOx", state: "Active" },
		]);
		await expect(
			new LabService(gateway).getActiveReservation(),
		).resolves.toMatchObject({
			id: "lab-1",
		});
	});

	it("fails clearly when nothing is active", async () => {
		const lab = new LabService(new FakeReservations([]));
		await expect(lab.getActiveReservation()).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("extends the active reservation", async () => {
		const gateway = new FakeReservations([
			{ id: "lab-1", name: "IOx", state: "Active" },
		]);
		await new LabService(gateway).extend(30);
		expect(gateway.extensions).toEqual([{ id: "lab-1", minutes: 30 }]);
	});
});
