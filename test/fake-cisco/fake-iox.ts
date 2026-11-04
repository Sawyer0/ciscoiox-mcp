import { type FakeRequest, json, parseJson, type Reply } from "./http-kit";
import { readTarEntries } from "./tar-entries";

interface FakeApp {
	id: string;
	name: string;
	state: "DEPLOYED" | "ACTIVATED" | "RUNNING" | "STOPPED";
	version: string;
	resources: { profile: string; cpu: number; memory: number; disk: number };
	packageFiles: string[];
}

const PREFIX = "/iox/api/v2/hosting";
const PROFILES: Record<string, { cpu: number; memory: number; vcpu: number }> =
	{
		"c1.tiny": { cpu: 100, memory: 32, vcpu: 1 },
		"c1.small": { cpu: 200, memory: 64, vcpu: 1 },
		"c1.medium": { cpu: 400, memory: 128, vcpu: 1 },
		"c1.large": { cpu: 600, memory: 256, vcpu: 1 },
		"c1.xlarge": { cpu: 1200, memory: 256, vcpu: 1 },
	};
const TOTAL = { cpu: 1000, memory: 512, disk: 256 };
/** Allowed transitions from the IOx Local Manager reference guide. */
const TRANSITIONS: Record<string, { from: string[]; to: FakeApp["state"] }> = {
	activate: { from: ["DEPLOYED"], to: "ACTIVATED" },
	start: { from: ["ACTIVATED", "STOPPED"], to: "RUNNING" },
	stop: { from: ["RUNNING"], to: "STOPPED" },
	deactivate: { from: ["ACTIVATED", "STOPPED"], to: "DEPLOYED" },
};

const error = (status: number, description: string): Reply =>
	json(status, { description, errorcode: -1, message: "Error" });

/** Fake of the CAF REST API used by IOx Local Manager and ioxclient. */
export class FakeIox {
	readonly apps = new Map<string, FakeApp>();
	private readonly tokens = new Set<string>();

	constructor(
		private readonly credentials = { username: "root", password: "cisco123" },
	) {}

	handle(request: FakeRequest): Reply | undefined {
		if (!request.path.startsWith(PREFIX)) return undefined;
		const path = request.path.slice(PREFIX.length);
		if (path === "/tokenservice" && request.method === "POST")
			return this.issueToken(request);
		if (!this.tokens.has(String(request.headers["x-token-id"] ?? ""))) {
			return error(401, "Invalid or missing X-Token-Id");
		}
		if (path === "/platform/sysinfo")
			return json(200, { product_id: "IR1101-K9", os_version: "17.9" });
		if (path === "/platform/resource/profiles") return json(200, PROFILES);
		if (path === "/platform/resource/allocations")
			return json(200, this.allocations());
		if (path === "/admin/download/logs")
			return this.downloadLog(request.query.get("filename") ?? "");
		if (path === "/apps" && request.method === "GET")
			return json(200, [...this.apps.values()].map(this.view));
		if (path === "/apps" && request.method === "POST")
			return this.install(request);

		const match = /^\/apps\/([^/]+)(\/state|\/logs|\/metrics)?$/.exec(path);
		const app = match
			? this.apps.get(decodeURIComponent(match[1] ?? ""))
			: undefined;
		if (!match || !app) return error(404, "No such app");
		const sub = match[2];
		if (!sub && request.method === "GET") return json(200, this.view(app));
		if (!sub && request.method === "DELETE") return this.uninstall(app);
		if (sub === "/state" && request.method === "POST")
			return this.changeState(app, request);
		if (sub === "/logs") return json(200, this.logIndex(app));
		if (sub === "/metrics") return this.metrics(app);
		return error(405, "Method not allowed");
	}

	expireTokens(): void {
		this.tokens.clear();
	}

	private issueToken(request: FakeRequest): Reply {
		const expected = Buffer.from(
			`${this.credentials.username}:${this.credentials.password}`,
		).toString("base64");
		if (request.headers.authorization !== `Basic ${expected}`)
			return error(401, "Bad credentials");
		const id = `token-${this.tokens.size + 1}`;
		this.tokens.add(id);
		return json(202, { token: { id, expiry_period: 3600 } });
	}

	private view = (app: FakeApp) => ({
		id: app.id,
		name: app.name,
		state: app.state,
		version: app.version,
		resources: { ...app.resources, cpu: String(app.resources.cpu) },
	});

	private install(request: FakeRequest): Reply {
		const id = String(request.headers["x-app-id"] ?? "");
		if (!/^\w{1,64}$/.test(id)) return error(400, "Invalid app id");
		if (this.apps.has(id)) return error(409, `App ${id} already exists`);
		let files: string[];
		try {
			files = readTarEntries(request.body).map((entry) => entry.path);
		} catch {
			return error(400, "Package is not a valid tar archive");
		}
		if (!files.includes("package.yaml"))
			return error(400, "package.yaml missing from package");
		this.apps.set(id, {
			id,
			name: id,
			state: "DEPLOYED",
			version: "1.0",
			resources: { profile: "c1.small", cpu: 200, memory: 64, disk: 10 },
			packageFiles: files,
		});
		return json(201, { message: `App ${id} installed` });
	}

	private changeState(app: FakeApp, request: FakeRequest): Reply {
		const action = request.query.get("action") ?? "";
		const rule = TRANSITIONS[action];
		if (!rule) return error(400, `Unknown action ${action}`);
		if (!rule.from.includes(app.state)) {
			return error(409, `Cannot ${action} app in state ${app.state}`);
		}
		if (action === "activate") {
			const requested = parseJson(request).resources as
				| Partial<FakeApp["resources"]>
				| undefined;
			const profile = PROFILES[requested?.profile ?? app.resources.profile];
			app.resources = {
				profile: requested?.profile ?? app.resources.profile,
				cpu: Number(requested?.cpu ?? profile?.cpu ?? app.resources.cpu),
				memory: Number(
					requested?.memory ?? profile?.memory ?? app.resources.memory,
				),
				disk: Number(requested?.disk ?? app.resources.disk),
			};
			const free = this.allocations();
			if (app.resources.cpu > free.cpu.available_cpu)
				return error(500, "Insufficient CPU");
		}
		app.state = rule.to;
		return json(200, {
			message: `App ${app.id} state changed to ${app.state}`,
		});
	}

	private uninstall(app: FakeApp): Reply {
		if (app.state !== "DEPLOYED")
			return error(409, `Cannot delete app in state ${app.state}`);
		this.apps.delete(app.id);
		return json(200, { message: `App ${app.id} uninstalled` });
	}

	private allocations() {
		const reserved = [...this.apps.values()].filter(
			(a) => a.state !== "DEPLOYED",
		);
		const sum = (key: "cpu" | "memory" | "disk") =>
			reserved.reduce((total, a) => total + a.resources[key], 0);
		return {
			cpu: { total_cpu: TOTAL.cpu, available_cpu: TOTAL.cpu - sum("cpu") },
			memory: {
				total_memory: TOTAL.memory,
				available_memory: TOTAL.memory - sum("memory"),
			},
			disk: {
				total_persistent_disk: TOTAL.disk,
				available_persistent_disk: TOTAL.disk - sum("disk"),
			},
		};
	}

	private logIndex(app: FakeApp) {
		return ["stdout.log", "watchDog.log"].map((filename) => ({
			filename,
			size_bytes: this.logText(app.id, filename).length,
			timestamp: "Sat Jan 10 17:00:00 2026",
			download_link: `/admin/download/logs?filename=${app.id}-${filename}`,
		}));
	}

	private logText(appId: string, filename: string): string {
		return Array.from(
			{ length: 5 },
			(_, i) => `${appId} ${filename} line ${i + 1}`,
		).join("\n");
	}

	private downloadLog(qualified: string): Reply {
		const app = [...this.apps.values()].find((a) =>
			qualified.startsWith(`${a.id}-`),
		);
		if (!app) return error(404, "No such log");
		return {
			status: 200,
			body: this.logText(app.id, qualified.slice(app.id.length + 1)),
		};
	}

	private metrics(app: FakeApp): Reply {
		const running = app.state === "RUNNING";
		return json(200, {
			[app.id]: {
				memory: { current: running ? 6688 : 0, unit: "KB" },
				cpu: { current: running ? 0.01 : 0, unit: "percent" },
				network: { current: running ? 99601 : 0, unit: "bytes" },
				disk: { current: 0.03, unit: "MB" },
			},
		});
	}
}
