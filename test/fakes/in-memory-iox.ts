import { NotFoundError, UpstreamError } from "../../src/domain/errors";
import type {
	AppMetrics,
	IoxApp,
	IoxGateway,
	LifecycleAction,
	LogFile,
	ResourceAllocations,
	ResourceProfile,
	ResourceRequest,
} from "../../src/domain/iox";
import { ALLOWED_FROM } from "../../src/domain/lifecycle";

const NEXT_STATE: Record<LifecycleAction, string> = {
	activate: "ACTIVATED",
	start: "RUNNING",
	stop: "STOPPED",
	deactivate: "DEPLOYED",
};

/** In-memory IoxGateway with CAF-like state rules and a call log. */
export class InMemoryIox implements IoxGateway {
	readonly apps = new Map<string, IoxApp>();
	readonly calls: string[] = [];
	readonly installed = new Map<string, Uint8Array>();
	logs: Record<string, string> = { "stdout.log": "one\ntwo\nthree\n" };
	profiles: ResourceProfile[] = [
		{ name: "c1.small", cpu: 200, memory: 64 },
		{ name: "c1.large", cpu: 600, memory: 256 },
	];
	allocations: ResourceAllocations = {
		cpu: { total: 1000, available: 400 },
		memory: { total: 512, available: 512 },
		disk: { total: 256, available: 256 },
	};

	seed(app: IoxApp): this {
		this.apps.set(app.id, app);
		return this;
	}

	async platformInfo(): Promise<Record<string, unknown>> {
		return { product_id: "IR1101-K9" };
	}

	async listApps(): Promise<IoxApp[]> {
		return [...this.apps.values()];
	}

	async getApp(appId: string): Promise<IoxApp> {
		const app = this.apps.get(appId);
		if (!app)
			throw new NotFoundError(
				`IOx app "${appId}" was not found on the device.`,
			);
		return { ...app };
	}

	async installApp(appId: string, packageBytes: Uint8Array): Promise<void> {
		this.calls.push(`install ${appId}`);
		this.installed.set(appId, packageBytes);
		this.apps.set(appId, { id: appId, name: appId, state: "DEPLOYED" });
	}

	async changeState(
		appId: string,
		action: LifecycleAction,
		resources?: ResourceRequest,
	): Promise<void> {
		const app = await this.getApp(appId);
		if (!ALLOWED_FROM[action].includes(app.state)) {
			throw new UpstreamError(
				`HTTP 409: Cannot ${action} app in state ${app.state}`,
				409,
			);
		}
		this.calls.push(
			resources
				? `${action} ${appId} ${JSON.stringify(resources)}`
				: `${action} ${appId}`,
		);
		this.apps.set(appId, {
			...app,
			state: NEXT_STATE[action],
			...(resources ? { resources } : {}),
		});
	}

	async deleteApp(appId: string): Promise<void> {
		const app = await this.getApp(appId);
		if (app.state !== "DEPLOYED")
			throw new UpstreamError("HTTP 409: app not deployed", 409);
		this.calls.push(`delete ${appId}`);
		this.apps.delete(appId);
	}

	async listLogs(appId: string): Promise<LogFile[]> {
		await this.getApp(appId);
		return Object.entries(this.logs).map(([filename, text]) => ({
			filename,
			sizeBytes: text.length,
			downloadLink: `/admin/download/logs?filename=${appId}-${filename}`,
		}));
	}

	async downloadLog(downloadLink: string): Promise<string> {
		const filename = Object.keys(this.logs).find((f) =>
			downloadLink.endsWith(`-${f}`),
		);
		return filename ? (this.logs[filename] ?? "") : "";
	}

	async appMetrics(appId: string): Promise<AppMetrics> {
		await this.getApp(appId);
		return {
			appId,
			memoryKb: 6688,
			cpuPercent: 0.01,
			networkBytes: 99601,
			diskMb: 0.03,
		};
	}

	async resourceProfiles(): Promise<ResourceProfile[]> {
		return this.profiles;
	}

	async resourceAllocations(): Promise<ResourceAllocations> {
		return this.allocations;
	}
}
