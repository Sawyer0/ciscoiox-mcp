import { NotFoundError } from "../domain/errors";
import type {
	AppMetrics,
	IoxGateway,
	LogFile,
	ResourceAllocations,
	ResourceProfile,
} from "../domain/iox";

export interface PlatformStatus {
	info: Record<string, unknown>;
	allocations: ResourceAllocations;
	profiles: ResourceProfile[];
}

export interface LogTail {
	appId: string;
	filename: string;
	lineCount: number;
	content: string;
}

export interface AppHealth extends AppMetrics {
	state: string;
}

/** Read-only views of the device: platform capacity, app logs and app metrics. */
export class AppInsightsService {
	constructor(private readonly iox: IoxGateway) {}

	async platformStatus(): Promise<PlatformStatus> {
		const [info, allocations, profiles] = await Promise.all([
			this.iox.platformInfo(),
			this.iox.resourceAllocations(),
			this.iox.resourceProfiles(),
		]);
		return { info, allocations, profiles };
	}

	listLogs(appId: string): Promise<LogFile[]> {
		return this.iox.listLogs(appId);
	}

	/** Returns the last `lines` lines of one of the app's log files. */
	async tailLog(
		appId: string,
		filename: string,
		lines: number,
	): Promise<LogTail> {
		const logs = await this.iox.listLogs(appId);
		const log = logs.find((l) => l.filename === filename);
		if (!log) {
			const available = logs.map((l) => l.filename).join(", ") || "none";
			throw new NotFoundError(
				`"${appId}" has no log named "${filename}". Available: ${available}.`,
			);
		}
		const all = (await this.iox.downloadLog(log.downloadLink))
			.replace(/\n$/, "")
			.split("\n");
		const tail = all.slice(-lines);
		return {
			appId,
			filename,
			lineCount: tail.length,
			content: tail.join("\n"),
		};
	}

	async appHealth(appId: string): Promise<AppHealth> {
		const [app, metrics] = await Promise.all([
			this.iox.getApp(appId),
			this.iox.appMetrics(appId),
		]);
		return { ...metrics, state: app.state };
	}
}
