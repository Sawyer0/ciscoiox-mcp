import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getReservationStatus } from "../quali/reservation";
import { extendReservation } from "../quali/extension";

export const registerLabTools = (server: McpServer) => {
	server.tool(
		"get_reservation_status",
		"Retrieves the current status and remaining time of the Cisco DevNet Sandbox reservation.",
		{},
		async () => {
            try {
                const status = await getReservationStatus();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(status, null, 2),
                        },
                    ],
                };
            } catch (error: any) {
                 return {
                    content: [
                        {
                            type: "text",
                            text: `Error fetching reservation status: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
		},
	);

	server.tool(
		"extend_reservation",
		"Extends the current sandbox reservation by a specified number of minutes (default: 60).",
		{
			minutes: z.number().min(1).optional().default(60).describe("Number of minutes to extend the reservation."),
		},
		async ({ minutes }) => {
            try {
                await extendReservation(minutes);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully extended reservation by ${minutes} minutes.`,
                        },
                    ],
                };
            } catch (error: any) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error extending reservation: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
		},
	);
};
