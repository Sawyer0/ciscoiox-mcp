import { ContractLog, contentType, jsonObject, onlyKeys } from "./contract";
import { type InstalledPackage, openPackage } from "./fake-iox-package";
import { type FakeRequest, json, type Reply } from "./http-kit";

export type FakeAppState = "DEPLOYED" | "ACTIVATED" | "RUNNING" | "STOPPED";

export interface FakeApp {
	id: string;
	state: FakeAppState;
	pkg: InstalledPackage;
	reserved: { profile: string; cpu: number; memory: number; disk: number };
	/** Every state the app has been in, oldest first. */
	history: FakeAppState[];
}

const PREFIX = "/iox/api/v2/hosting";
export const PROFILES: Record<
	string,
	{ cpu: number; memory: number; vcpu: number }
> = {
	default: { cpu: 200, memory: 64, vcpu: 1 },
	"c1.tiny": { cpu: 100, memory: 32, vcpu: 1 },
	"c1.small": { cpu: 200, memory: 64, vcpu: 1 },
	"c1.medium": { cpu: 400, memory: 128, vcpu: 1 },
	"c1.large": { cpu: 600, memory: 256, vcpu: 1 },
	"c1.xlarge": { cpu: 1200, memory: 256, vcpu: 1 },
};
const TOTAL = { cpu: 1000, memory: 512, disk: 256 };
/** Allowed transitions from the IOx Local Manager reference guide. */
const TRANSITIONS: Record<string, { from: FakeAppState[]; to: FakeAppState }> =
	{
		activate: { from: ["DEPLOYED"], to: "ACTIVATED" },
		start: { from: ["ACTIVATED", "STOPPED"], to: "RUNNING" },
		stop: { from: ["RUNNING"], to: "STOPPED" },
		deactivate: { from: ["ACTIVATED", "STOPPED"], to: "DEPLOYED" },
	};
const RESOURCE_KEYS = ["profile", "cpu", "memory", "disk"];

/** Legitimate CAF error responses (not client bugs). */
const cafError = (status: number, description: string): Reply =>
	json(status, { description, errorcode: -1, message: "Error" });

/**
 * Strict, stateful fake of the CAF REST API. Requests that break the
 * contract the real client must honour are rejected and logged in
 * `contract.violations`.
 */
export class FakeIox {
	readonly apps = new Map<string, FakeApp>();
	readonly contract = new ContractLog();
	private readonly tokens = new Set<string>();

	constructor(
		private readonly credentials = { username: "root", password: "cisco123" },
	) {}

	handle(request: FakeRequest): Reply | undefined {
		if (!request.path.startsWith(`${PREFIX}/`)) return undefined;
		const path = request.path.slice(PREFIX.length);
		if (path === "/tokenservice") {
			return request.method === "POST"
				? this.issueToken(request)
				: this.contract.reject(request, 405, "tokenservice only accepts POST");
		}
		const token = request.headers["x-token-id"];
		if (typeof token !== "string" || token === "") {
			return this.contract.reject(request, 401, "missing X-Token-Id header");
		}
		if (!this.tokens.has(token))
			return cafError(401, "Token expired or invalid");
		return this.route(request, path);
	}

	expireTokens(): void {
		this.tokens.clear();
	}

	private route(request: FakeRequest, path: string): Reply {
		const get = request.method === "GET";
		if (path === "/platform/sysinfo" && get) {
			return json(200, {
				product_id: "IR1101-K9",
				os_version: "17.9",
				serial_number: "FCW0000TEST",
			});
		}
		if (path === "/platform/resource/profiles" && get)
			return json(200, PROFILES);
		if (path === "/platform/resource/allocations" && get)
			return json(200, this.allocations());
		if (path === "/admin/download/logs" && get)
			return this.downloadLog(request);
		if (path === "/apps" && get)
			return json(200, [...this.apps.values()].map(this.view));
		if (path === "/apps" && request.method === "POST")
			return this.install(request);

		const match = /^\/apps\/(\w{1,64})(\/state|\/logs|\/metrics)?$/.exec(path);
		if (!match) return this.contract.reject(request, 404, "no such CAF route");
		const app = this.apps.get(match[1] ?? "");
		const sub = match[2] ?? "";
		const allowed: Record<string, string> = {
			"": "GET DELETE",
			"/state": "POST",
			"/logs": "GET",
			"/metrics": "GET",
		};
		if (!allowed[sub]?.split(" ").includes(request.method)) {
			return this.contract.reject(
				request,
				405,
				`${request.method} not allowed here`,
			);
		}
		if (!app) return cafError(404, `App ${match[1]} does not exist`);
		if (sub === "/state") return this.changeState(app, request);
		if (sub === "/logs") return json(200, this.logIndex(app));
		if (sub === "/metrics") return this.metrics(app);
		return request.method === "GET"
			? json(200, this.view(app))
			: this.uninstall(app, request);
	}

	private issueToken(request: FakeRequest): Reply {
		const auth = request.headers.authorization;
		if (!auth?.startsWith("Basic ")) {
			return this.contract.reject(
				request,
				401,
				"tokenservice requires HTTP Basic auth",
			);
		}
		const expected = Buffer.from(
			`${this.credentials.username}:${this.credentials.password}`,
		).toString("base64");
		if (auth !== `Basic ${expected}`) return cafError(401, "Bad credentials");
		const id = `token-${this.tokens.size + 1}`;
		this.tokens.add(id);
		return json(202, { token: { id, expiry_period: 3600 } });
	}

	private view = (app: FakeApp) => ({
		id: app.id,
		name: app.pkg.name,
		state: app.state,
		version: app.pkg.version,
		description: `${app.pkg.appType} app`,
		// CAF reports some quantities as strings; clients must cope.
		resources: { ...app.reserved, cpu: String(app.reserved.cpu) },
	});

	private install(request: FakeRequest): Reply {
		if (contentType(request) !== "application/octet-stream") {
			return this.contract.reject(
				request,
				415,
				"install expects Content-Type application/octet-stream",
			);
		}
		const id = request.headers["x-app-id"];
		if (typeof id !== "string" || !/^\w{1,64}$/.test(id)) {
			return this.contract.reject(
				request,
				400,
				"install needs an X-App-Id of 1-64 word characters",
			);
		}
		if (this.apps.has(id)) return cafError(409, `App ${id} already exists`);
		const pkg = openPackage(request.body);
		if (typeof pkg === "string") return this.contract.reject(request, 400, pkg);
		const profile = PROFILES[pkg.resources.profile] ?? PROFILES.default;
		this.apps.set(id, {
			id,
			state: "DEPLOYED",
			pkg,
			reserved: {
				profile: pkg.resources.profile,
				cpu: pkg.resources.cpu ?? profile?.cpu ?? 0,
				memory: pkg.resources.memory ?? profile?.memory ?? 0,
				disk: pkg.resources.disk,
			},
			history: ["DEPLOYED"],
		});
		return json(201, { message: `App ${id} installed` });
	}

	private changeState(app: FakeApp, request: FakeRequest): Reply {
		const action = request.query.get("action") ?? "";
		const extra = [...request.query.keys()].filter((key) => key !== "action");
		const rule = TRANSITIONS[action];
		if (!rule || extra.length > 0) {
			return this.contract.reject(
				request,
				400,
				`state change needs ?action=<activate|start|stop|deactivate> only, got "${request.query}"`,
			);
		}
		const payload = this.statePayload(request, action);
		if (typeof payload === "string")
			return this.contract.reject(request, 400, payload);
		if (!rule.from.includes(app.state))
			return cafError(409, `Cannot ${action} app in state ${app.state}`);
		if (action === "activate") {
			const requested = payload ?? {};
			const profileName =
				typeof requested.profile === "string"
					? requested.profile
					: app.reserved.profile;
			const profile = PROFILES[profileName];
			if (!profile && profileName !== "custom")
				return cafError(400, `Unknown profile ${profileName}`);
			const reserved = {
				profile: profileName,
				cpu: Number(requested.cpu ?? profile?.cpu ?? app.reserved.cpu),
				memory: Number(
					requested.memory ?? profile?.memory ?? app.reserved.memory,
				),
				disk: Number(requested.disk ?? app.reserved.disk),
			};
			const free = this.allocations();
			if (
				reserved.cpu > free.cpu.available_cpu ||
				reserved.memory > free.memory.available_memory
			) {
				return cafError(500, "App Activation error: insufficient resources");
			}
			app.reserved = reserved;
		}
		app.state = rule.to;
		app.history.push(rule.to);
		return json(200, {
			message: `App ${app.id} state changed to ${app.state}`,
		});
	}

	/** Only activate may carry a body: JSON { resources: { profile|cpu|memory|disk } }. */
	private statePayload(
		request: FakeRequest,
		action: string,
	): Record<string, unknown> | undefined | string {
		if (request.body.length === 0) return undefined;
		if (action !== "activate") return `${action} must not send a body`;
		if (contentType(request) !== "application/json")
			return "activation payload must be application/json";
		const body = jsonObject(request);
		if (!body || onlyKeys(body, ["resources"]).length > 0)
			return "activation payload must be { resources: {...} }";
		const resources = body.resources;
		if (!resources || typeof resources !== "object")
			return "activation payload needs a resources object";
		const unknown = onlyKeys(
			resources as Record<string, unknown>,
			RESOURCE_KEYS,
		);
		if (unknown.length > 0)
			return `unknown resource keys: ${unknown.join(", ")}`;
		return resources as Record<string, unknown>;
	}

	private uninstall(app: FakeApp, request: FakeRequest): Reply {
		if (request.body.length > 0)
			return this.contract.reject(request, 400, "DELETE must not send a body");
		if (app.state !== "DEPLOYED")
			return cafError(409, `Cannot delete app in state ${app.state}`);
		this.apps.delete(app.id);
		return json(200, { message: `App ${app.id} uninstalled` });
	}

	private allocations() {
		const reserved = [...this.apps.values()].filter(
			(a) => a.state !== "DEPLOYED",
		);
		const sum = (key: "cpu" | "memory" | "disk") =>
			reserved.reduce((total, a) => total + a.reserved[key], 0);
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
			size_bytes: this.logText(app, filename).length,
			timestamp: "Sat Jan 10 17:00:00 2026",
			download_link: `/admin/download/logs?filename=${app.id}-${filename}`,
		}));
	}

	/** Log lines reflect the app's real history, so tests see state-dependent output. */
	logText(app: FakeApp, filename: string): string {
		if (filename === "watchDog.log") {
			return app.history
				.map((state, i) => `${i + 1}: ${app.id} entered ${state}`)
				.join("\n");
		}
		const runs = app.history.filter((s) => s === "RUNNING").length;
		return Array.from(
			{ length: runs * 3 },
			(_, i) => `${app.pkg.name} says hello #${i + 1}`,
		).join("\n");
	}

	private downloadLog(request: FakeRequest): Reply {
		const qualified = request.query.get("filename");
		if (!qualified)
			return this.contract.reject(
				request,
				400,
				"log download needs ?filename=",
			);
		const app = [...this.apps.values()].find((a) =>
			qualified.startsWith(`${a.id}-`),
		);
		if (!app) return cafError(404, "No such log");
		return {
			status: 200,
			body: this.logText(app, qualified.slice(app.id.length + 1)),
		};
	}

	private metrics(app: FakeApp): Reply {
		const running = app.state === "RUNNING";
		return json(200, {
			[app.id]: {
				memory: {
					current: running ? app.reserved.memory * 100 : 0,
					unit: "KB",
				},
				cpu: { current: running ? 1.5 : 0, unit: "percent" },
				network: { current: running ? 99601 : 0, unit: "bytes" },
				disk: { current: 0.03, unit: "MB" },
			},
		});
	}
}
