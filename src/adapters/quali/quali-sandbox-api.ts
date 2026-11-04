import axios, {
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";
import { z } from "zod";
import type { QualiConfig } from "../../config/env";
import type { Reservation, ReservationGateway } from "../../domain/reservation";
import { toUpstreamError } from "../http/upstream-error";

const SERVICE = "Quali CloudShell API";

const sandboxSchema = z.object({
	id: z.string(),
	name: z.string().default(""),
	state: z.string(),
	setup_start_time: z.string().optional(),
	end_time: z.string().optional(),
});

type RetriableRequest = InternalAxiosRequestConfig & { retried?: boolean };

const toReservation = (raw: unknown): Reservation => {
	const sandbox = sandboxSchema.parse(raw);
	return {
		id: sandbox.id,
		name: sandbox.name,
		state: sandbox.state,
		...(sandbox.setup_start_time
			? { startTime: sandbox.setup_start_time }
			: {}),
		...(sandbox.end_time ? { endTime: sandbox.end_time } : {}),
	};
};

/** ReservationGateway backed by the CloudShell Sandbox REST API. */
export class QualiSandboxApi implements ReservationGateway {
	private readonly http: AxiosInstance;
	private token: string | null = null;

	constructor(private readonly config: QualiConfig) {
		this.http = axios.create({
			baseURL: `${config.baseUrl}/v1`,
			headers: { "Content-Type": "application/json" },
		});
		this.http.interceptors.response.use(undefined, (error) =>
			this.retryOnceAfterLogin(error),
		);
	}

	async listReservations(): Promise<Reservation[]> {
		const data = await this.request("get", "/sandboxes");
		return z.array(z.unknown()).parse(data).map(toReservation);
	}

	async getReservation(id: string): Promise<Reservation> {
		return toReservation(
			await this.request("get", `/sandboxes/${encodeURIComponent(id)}`),
		);
	}

	async extendReservation(id: string, minutes: number): Promise<Reservation> {
		await this.request("post", `/sandboxes/${encodeURIComponent(id)}/extend`, {
			duration_minutes: minutes,
		});
		return this.getReservation(id);
	}

	private async request(
		method: "get" | "post",
		url: string,
		body?: unknown,
	): Promise<unknown> {
		await this.login();
		try {
			const response = await this.http.request({ method, url, data: body });
			return response.data;
		} catch (error) {
			throw toUpstreamError(error, SERVICE);
		}
	}

	private async login(force = false): Promise<void> {
		if (this.token && !force) return;
		try {
			const response = await this.http.put("/login", {
				username: this.config.username,
				password: this.config.password,
				domain: this.config.domain,
			});
			this.token = String(response.data).replace(/"/g, "");
			this.http.defaults.headers.common.Authorization = `Basic ${this.token}`;
		} catch (error) {
			throw toUpstreamError(error, `${SERVICE} login`);
		}
	}

	private async retryOnceAfterLogin(error: unknown): Promise<unknown> {
		if (!axios.isAxiosError(error) || error.response?.status !== 401)
			throw error;
		const request = error.config as RetriableRequest | undefined;
		if (!request || request.retried || request.url === "/login") throw error;
		request.retried = true;
		await this.login(true);
		request.headers.Authorization = `Basic ${this.token}`;
		return this.http.request(request);
	}
}
