import { describe, expect, it } from "vitest";
import { connectClient, jsonOf, textOf } from "../../test/fakes/connect-client";
import { FakeReservations } from "../../test/fakes/fake-reservations";
import { LabService } from "../services/lab-service";

const connect = (gateway: FakeReservations) =>
	connectClient({ lab: new LabService(gateway) });
const ready = () =>
	new FakeReservations([{ id: "lab-1", name: "IOx", state: "Ready" }]);

describe("lab tools", () => {
	it("registers only the lab tools when IOx is not configured", async () => {
		const { tools } = await (await connect(ready())).listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"extend_reservation",
			"get_reservation_status",
		]);
	});

	it("reports the active reservation", async () => {
		const client = await connect(ready());
		const result = await client.callTool({
			name: "get_reservation_status",
			arguments: {},
		});
		expect(result.isError).toBeFalsy();
		expect(jsonOf(result)).toMatchObject({ id: "lab-1" });
	});

	it("extends by 60 minutes by default", async () => {
		const gateway = ready();
		await (await connect(gateway)).callTool({
			name: "extend_reservation",
			arguments: {},
		});
		expect(gateway.extensions).toEqual([{ id: "lab-1", duration: "PT1H" }]);
	});

	it("validates the minutes argument", async () => {
		const client = await connect(ready());
		const result = await client.callTool({
			name: "extend_reservation",
			arguments: { minutes: 0 },
		});
		expect(result.isError).toBe(true);
	});

	it("returns an MCP error result when there is no lab", async () => {
		const client = await connect(new FakeReservations([]));
		const result = await client.callTool({
			name: "get_reservation_status",
			arguments: {},
		});
		expect(result.isError).toBe(true);
		expect(textOf(result)).toMatch(
			/^Error fetching reservation status: No live lab/,
		);
	});
});
