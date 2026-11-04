import { NotFoundError } from "../domain/errors";
import type {
	Reservation,
	ReservationGateway,
	ReservationStatus,
} from "../domain/reservation";

/** Usable states, best first. Teardown, Error and Ended labs cannot be worked in. */
const LIVE_STATES = ["Ready", "Setup", "Pending"];

/** Converts minutes into the ISO 8601 duration CloudShell expects, e.g. 90 -> PT1H30M. */
export function toIsoDuration(minutes: number): string {
	if (!Number.isInteger(minutes) || minutes < 1) {
		throw new RangeError(`minutes must be a positive integer, got ${minutes}`);
	}
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return `PT${hours ? `${hours}H` : ""}${rest ? `${rest}M` : ""}`;
}

export class LabService {
	constructor(
		private readonly gateway: ReservationGateway,
		private readonly options: { labId?: string; now?: () => Date } = {},
	) {}

	async getActiveReservation(): Promise<ReservationStatus> {
		const id = this.options.labId ?? (await this.findLiveReservation()).id;
		return this.withMinutesRemaining(await this.gateway.getReservation(id));
	}

	async extend(minutes: number): Promise<ReservationStatus> {
		const { id } = await this.getActiveReservation();
		const extended = await this.gateway.extendReservation(
			id,
			toIsoDuration(minutes),
		);
		return this.withMinutesRemaining(extended);
	}

	private async findLiveReservation(): Promise<Reservation> {
		const reservations = await this.gateway.listReservations();
		for (const state of LIVE_STATES) {
			const match = reservations.find((r) => r.state === state);
			if (match) return match;
		}
		throw new NotFoundError(
			"No live lab reservation found (looked for Ready, Setup or Pending). Reserve the IOx sandbox first or set LAB_ID.",
		);
	}

	private withMinutesRemaining(reservation: Reservation): ReservationStatus {
		if (!reservation.endTime) return reservation;
		const end = Date.parse(reservation.endTime);
		if (Number.isNaN(end)) return reservation;
		const now = (this.options.now ?? (() => new Date()))().getTime();
		return {
			...reservation,
			minutesRemaining: Math.max(0, Math.floor((end - now) / 60_000)),
		};
	}
}
