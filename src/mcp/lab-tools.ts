import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LabService } from "../services/lab-service";
import { jsonResult, runTool } from "./tool-response";

export function registerLabTools(server: McpServer, lab: LabService): void {
	server.registerTool(
		"get_reservation_status",
		{
			title: "Get lab reservation status",
			description:
				"Returns the active Cisco DevNet sandbox reservation: id, name, state and end time.",
			annotations: { readOnlyHint: true },
		},
		() =>
			runTool("fetching reservation status", async () =>
				jsonResult(await lab.getActiveReservation()),
			),
	);

	server.registerTool(
		"extend_reservation",
		{
			title: "Extend lab reservation",
			description:
				"Extends the active sandbox reservation by the given number of minutes (default 60).",
			inputSchema: {
				minutes: z
					.number()
					.int()
					.min(1)
					.max(24 * 60)
					.default(60)
					.describe("Minutes to add to the reservation."),
			},
		},
		({ minutes }) =>
			runTool("extending reservation", async () =>
				jsonResult(await lab.extend(minutes)),
			),
	);
}
