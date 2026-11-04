import https from "node:https";
import axios, {
	type AxiosInstance,
	type AxiosRequestConfig,
	type InternalAxiosRequestConfig,
} from "axios";
import type { IoxConfig } from "../../config/env";
import { NotFoundError, UpstreamError } from "../../domain/errors";
import type {
	AppMetrics,
	IoxApp,
	IoxGateway,
	LifecycleAction,
	LogFile,
	ResourceAllocations,
	ResourceProfile,
	ResourceRequest,
} from "../../domain/iox";
import { toUpstreamError } from "../http/upstream-error";
import {
	parseAllocations,
	parseApp,
	parseAppList,
	parseLogs,
	parseMetrics,
	parseProfiles,
	parseToken,
} from "./iox-payloads";
import { IoxRoutes } from "./iox-routes";

const SERVICE = "IOx CAF API";
const TOKEN_HEADER = "X-Token-Id";

type RetriableRequest = InternalAxiosRequestConfig & { retried?: boolean };

/** IoxGateway backed by the Cisco Application Framework (CAF) REST API. */
export class IoxCafApi implements IoxGateway {
	private readonly http: AxiosInstance;
	private token: string | null = null;

	constructor(private readonly config: IoxConfig) {
		this.http = axios.create({
			baseURL: config.baseUrl,
			timeout: 120_000,
			maxBodyLength: Number.POSITIVE_INFINITY,
			maxContentLength: Number.POSITIVE_INFINITY,
			httpsAgent: new https.Agent({ rejectUnauthorized: config.verifyTls }),
		});
		this.http.interceptors.response.use(undefined, (error) =>
			this.retryOnceAfterLogin(error),
		);
	}

	async platformInfo(): Promise<Record<string, unknown>> {
		const data = await this.call({ method: "get", url: IoxRoutes.sysinfo });
		return typeof data === "object" && data !== null
			? (data as Record<string, unknown>)
			: { info: data };
	}

	async listApps(): Promise<IoxApp[]> {
		return parseAppList(
			await this.call({ method: "get", url: IoxRoutes.apps }),
		);
	}

	async getApp(appId: string): Promise<IoxApp> {
		const data = await this.call(
			{ method: "get", url: IoxRoutes.app(appId) },
			appId,
		);
		return parseApp(data, appId);
	}

	async installApp(appId: string, packageBytes: Uint8Array): Promise<void> {
		await this.call({
			method: "post",
			url: IoxRoutes.apps,
			data: Buffer.from(packageBytes),
			headers: {
				"X-App-Id": appId,
				"Content-Type": "application/octet-stream",
			},
		});
	}

	async changeState(
		appId: string,
		action: LifecycleAction,
		resources?: ResourceRequest,
	): Promise<void> {
		await this.call(
			{
				method: "post",
				url: IoxRoutes.state(appId),
				params: { action },
				...(resources ? { data: { resources } } : {}),
			},
			appId,
		);
	}

	async deleteApp(appId: string): Promise<void> {
		await this.call({ method: "delete", url: IoxRoutes.app(appId) }, appId);
	}

	async listLogs(appId: string): Promise<LogFile[]> {
		return parseLogs(
			await this.call({ method: "get", url: IoxRoutes.logs(appId) }, appId),
		);
	}

	async downloadLog(downloadLink: string): Promise<string> {
		const url = this.sameHostPath(downloadLink);
		const data = await this.call({ method: "get", url, responseType: "text" });
		return typeof data === "string" ? data : JSON.stringify(data);
	}

	async appMetrics(appId: string): Promise<AppMetrics> {
		const data = await this.call(
			{ method: "get", url: IoxRoutes.metrics(appId) },
			appId,
		);
		return parseMetrics(appId, data);
	}

	async resourceProfiles(): Promise<ResourceProfile[]> {
		return parseProfiles(
			await this.call({ method: "get", url: IoxRoutes.profiles }),
		);
	}

	async resourceAllocations(): Promise<ResourceAllocations> {
		return parseAllocations(
			await this.call({ method: "get", url: IoxRoutes.allocations }),
		);
	}

	/**
	 * CAF returns links such as "/admin/download/logs?filename=x", relative to the
	 * hosting prefix. Absolute links are only followed to the configured host so
	 * the session token is never sent elsewhere.
	 */
	private sameHostPath(link: string): string {
		if (!/^https?:\/\//i.test(link)) {
			return link.startsWith("/") ? link : `/${link}`;
		}
		const target = new URL(link);
		if (target.origin !== new URL(this.config.baseUrl).origin) {
			throw new UpstreamError(
				`Refusing to download a log from another host: ${target.origin}`,
			);
		}
		return target.href;
	}

	private async call(
		request: AxiosRequestConfig,
		appId?: string,
	): Promise<unknown> {
		await this.login();
		try {
			return (await this.http.request(request)).data;
		} catch (error) {
			const upstream = toUpstreamError(error, SERVICE);
			if (appId && upstream.status === 404) {
				throw new NotFoundError(
					`IOx app "${appId}" was not found on the device.`,
				);
			}
			throw upstream;
		}
	}

	private async login(force = false): Promise<void> {
		if (this.token && !force) return;
		try {
			const response = await this.http.post(IoxRoutes.token, undefined, {
				auth: {
					username: this.config.username,
					password: this.config.password,
				},
			});
			this.token = parseToken(response.data);
			this.http.defaults.headers.common[TOKEN_HEADER] = this.token;
		} catch (error) {
			throw toUpstreamError(error, `${SERVICE} login`);
		}
	}

	private async retryOnceAfterLogin(error: unknown): Promise<unknown> {
		if (!axios.isAxiosError(error) || error.response?.status !== 401)
			throw error;
		const request = error.config as RetriableRequest | undefined;
		if (!request || request.retried || request.url === IoxRoutes.token)
			throw error;
		request.retried = true;
		await this.login(true);
		request.headers.set(TOKEN_HEADER, this.token);
		return this.http.request(request);
	}
}
