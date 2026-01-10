import { createQualiClient } from "./client";
import { config } from "../config";

interface ReservationStatus {
	id: string;
	status: string;
	end_time: string;
	// Add other fields as needed
}

export const getReservationStatus = async (): Promise<ReservationStatus> => {
	const client = createQualiClient();
	const response = await client.get<ReservationStatus>(`/reservations/${config.LAB_ID}`);
	return response.data;
};
