import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { FakeReservations } from "../../test/fakes/fake-reservations";
import { LabService } from "../services/lab-service";
import { createMcpServer } from "./server";

async function connect(gateway: FakeReservations) {
	const server = createMcpServer({ lab: new LabService(gateway) });
	const client = new Client({ name: "test", version: "1.0.0" });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
	return client;
}

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) =>
	(result.content as Array<{ text: string }>)[0]?.text ?? "";

describe("lab tools", () => {
	it("lists the lab tools", async () => {
		const client = await connect(new FakeReservations([]));
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"extend_reservation",
			"get_reservation_status",
		]);
	});

	it("reports the active reservation", async () => {
		const client = await connect(
			new FakeReservations([{ id: "lab-1", name: "IOx", state: "Active" }]),
		);
		const result = await client.callTool({
			name: "get_reservation_status",
			arguments: {},
		});
		expect(result.isError).toBeFalsy();
		expect(JSON.parse(textOf(result))).toMatchObject({ id: "lab-1" });
	});

	it("extends by 60 minutes by default", async () => {
		const gateway = new FakeReservations([
			{ id: "lab-1", name: "IOx", state: "Active" },
		]);
		const client = await connect(gateway);
		await client.callTool({ name: "extend_reservation", arguments: {} });
		expect(gateway.extensions).toEqual([{ id: "lab-1", minutes: 60 }]);
	});

	it("returns an MCP error result when there is no lab", async () => {
		const client = await connect(new FakeReservations([]));
		const result = await client.callTool({
			name: "get_reservation_status",
			arguments: {},
		});
		expect(result.isError).toBe(true);
		expect(textOf(result)).toBe(
			"Error fetching reservation status: No active lab reservation found.",
		);
	});
});
