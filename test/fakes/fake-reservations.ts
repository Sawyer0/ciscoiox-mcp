import { NotFoundError } from "../../src/domain/errors";
import type {
	Reservation,
	ReservationGateway,
} from "../../src/domain/reservation";

/** In-memory ReservationGateway that records extensions. */
export class FakeReservations implements ReservationGateway {
	readonly extensions: Array<{ id: string; duration: string }> = [];

	constructor(public reservations: Reservation[]) {}

	async listReservations(): Promise<Reservation[]> {
		return this.reservations;
	}

	async getReservation(id: string): Promise<Reservation> {
		const found = this.reservations.find((r) => r.id === id);
		if (!found) throw new NotFoundError(`Reservation ${id} not found.`);
		return found;
	}

	async extendReservation(id: string, duration: string): Promise<Reservation> {
		this.extensions.push({ id, duration });
		return { ...(await this.getReservation(id)), remainingTime: duration };
	}
}
