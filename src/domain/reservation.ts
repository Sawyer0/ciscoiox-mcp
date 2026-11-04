/** A CloudShell sandbox reservation as the DevNet lab portal reports it. */
export interface Reservation {
	id: string;
	name: string;
	state: string;
	startTime?: string;
	endTime?: string;
	remainingTime?: string;
}

/** Port to the lab reservation system (Quali CloudShell in the DevNet sandbox). */
export interface ReservationGateway {
	listReservations(): Promise<Reservation[]>;
	getReservation(id: string): Promise<Reservation>;
	extendReservation(id: string, minutes: number): Promise<Reservation>;
}
