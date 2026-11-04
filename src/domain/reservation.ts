/** A CloudShell sandbox reservation as the DevNet lab portal reports it. */
export interface Reservation {
	id: string;
	name: string;
	/** CloudShell state: Pending, Setup, Ready, Teardown, Error or Ended. */
	state: string;
	startTime?: string;
	endTime?: string;
	/** ISO 8601 duration reported by CloudShell after an extension. */
	remainingTime?: string;
}

export interface ReservationStatus extends Reservation {
	minutesRemaining?: number;
}

/** Port to the lab reservation system (Quali CloudShell in the DevNet sandbox). */
export interface ReservationGateway {
	listReservations(): Promise<Reservation[]>;
	getReservation(id: string): Promise<Reservation>;
	/** Extends by an ISO 8601 duration such as PT1H30M. */
	extendReservation(id: string, duration: string): Promise<Reservation>;
}
