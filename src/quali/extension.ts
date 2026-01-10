import { createQualiClient } from "./client";
import { config } from "../config";

export const extendReservation = async (minutes: number): Promise<void> => {
	const client = createQualiClient();
	await client.post(`/reservations/${config.LAB_ID}/extend`, {
		durationInMinutes: minutes,
	});
};
