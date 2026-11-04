import { NotFoundError } from "../domain/errors";
import type { Reservation, ReservationGateway } from "../domain/reservation";

export class LabService {
	constructor(private readonly gateway: ReservationGateway) {}

	async getActiveReservation(): Promise<Reservation> {
		const reservations = await this.gateway.listReservations();
		const active = reservations.find((r) => r.state === "Active");
		if (!active) {
			throw new NotFoundError("No active lab reservation found.");
		}
		return active;
	}

	async extend(minutes: number): Promise<Reservation> {
		const reservation = await this.getActiveReservation();
		return this.gateway.extendReservation(reservation.id, minutes);
	}
}
