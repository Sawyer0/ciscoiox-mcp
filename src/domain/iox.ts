/** Lifecycle states reported by Cisco IOx Local Manager / CAF. */
export type AppState = "DEPLOYED" | "ACTIVATED" | "RUNNING" | "STOPPED";

export type LifecycleAction = "activate" | "start" | "stop" | "deactivate";

/** Resources requested for an app, in CAF units: CPU units, memory MB, disk MB. */
export interface ResourceRequest {
	profile?: string;
	cpu?: number;
	memory?: number;
	disk?: number;
}

export interface IoxApp {
	id: string;
	name: string;
	/** Usually an AppState; kept as a string because devices may report others. */
	state: string;
	version?: string;
	description?: string;
	resources?: ResourceRequest;
}

export interface LogFile {
	filename: string;
	sizeBytes: number;
	timestamp?: string;
	downloadLink: string;
}

export interface AppMetrics {
	appId: string;
	memoryKb?: number;
	cpuPercent?: number;
	networkBytes?: number;
	diskMb?: number;
}

export interface ResourceProfile {
	name: string;
	cpu: number;
	memory: number;
}

export interface Capacity {
	total: number;
	available: number;
}

export interface ResourceAllocations {
	cpu: Capacity;
	memory: Capacity;
	disk: Capacity;
}

/** Port to an IOx host's application-hosting API. */
export interface IoxGateway {
	platformInfo(): Promise<Record<string, unknown>>;
	listApps(): Promise<IoxApp[]>;
	getApp(appId: string): Promise<IoxApp>;
	installApp(appId: string, packageBytes: Uint8Array): Promise<void>;
	changeState(
		appId: string,
		action: LifecycleAction,
		resources?: ResourceRequest,
	): Promise<void>;
	deleteApp(appId: string): Promise<void>;
	listLogs(appId: string): Promise<LogFile[]>;
	downloadLog(downloadLink: string): Promise<string>;
	appMetrics(appId: string): Promise<AppMetrics>;
	resourceProfiles(): Promise<ResourceProfile[]>;
	resourceAllocations(): Promise<ResourceAllocations>;
}
