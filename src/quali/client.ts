import axios, { type AxiosInstance } from "axios";
import type { QualiConfig } from "../config/env";

export class QualiClient {
	private client: AxiosInstance;
	private token: string | null = null;

	constructor(private readonly config: QualiConfig) {
		const baseURL = `${config.baseUrl}/v1`;

		this.client = axios.create({
			baseURL,
			headers: { "Content-Type": "application/json" },
		});

		// Add 401 interceptor to handle expired tokens during runtime
		this.client.interceptors.response.use(
			(response) => response,
			async (error) => {
				if (error.response?.status === 401 && !error.config._retry) {
					error.config._retry = true;
					try {
						// Force re-login
						this.token = null;
						await this.ensureAuth();
						// Retry request with new token
						error.config.headers.Authorization =
							this.client.defaults.headers.common.Authorization;
						return this.client(error.config);
					} catch (loginError) {
						return Promise.reject(loginError);
					}
				}
				return Promise.reject(error);
			},
		);
	}

	private async ensureAuth() {
		if (this.token) return;

		try {
			console.error(`Logging in to ${this.client.defaults.baseURL}...`);
			const res = await this.client.put("/login", {
				username: this.config.username,
				password: this.config.password,
				domain: this.config.domain,
			});

			// The token comes back as a raw string with quotes usually
			this.token = res.data.replace(/"/g, "");

			// Attach token to all future requests
			this.client.defaults.headers.common["Authorization"] =
				`Basic ${this.token}`;
		} catch (err: any) {
			console.error("Login Failed:", err.message);
			if (err.response) console.error("Data:", err.response.data);
			throw new Error(
				`Could not log in to Lab API at ${this.client.defaults.baseURL}. Check VPN and IP.`,
			);
		}
	}

	async getReservationStatus() {
		await this.ensureAuth();

		// Get all active sandboxes for this user
		// Note: Check API docs if /sandboxes is correct or needs query params
		const res = await this.client.get("/sandboxes");

		// Find the active one
		// Note: The response structure needs to be verified. Assuming array of objects.
		const myLab = res.data.find((sb: any) => sb.state === "Active");
		if (!myLab) {
			throw new Error("No active labs found.");
		}

		return {
			id: myLab.id,
			name: myLab.name,
			status: myLab.state,
			start_time: myLab.setup_start_time,
			end_time: myLab.end_time,
		};
	}

	async extendReservation(minutes: number) {
		await this.ensureAuth();

		// First, we need the ID from the status check
		const status = await this.getReservationStatus();

		// Now call the extend endpoint
		await this.client.post(`/sandboxes/${status.id}/extend`, {
			duration_minutes: minutes,
		});

		return `Extended lab ${status.id} by ${minutes} minutes.`;
	}
}
