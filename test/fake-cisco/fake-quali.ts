import { ContractLog, contentType, jsonObject, onlyKeys } from "./contract";
import { type FakeRequest, json, type Reply } from "./http-kit";

export interface FakeSandbox {
	id: string;
	name: string;
	state: string;
	start_time: string;
	end_time: string;
}

const PREFIX = "/api";
const ISO_DURATION = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;

/**
 * Strict, stateful fake of the CloudShell Sandbox API v2, shaped after
 * help.quali.com (login, sandboxes, sandbox details, sandbox extend).
 */
export class FakeQuali {
	readonly contract = new ContractLog();
	readonly sandboxes: FakeSandbox[] = [
		{
			id: "c1d2e3f4-0000-4000-8000-000000000001",
			name: "IOx Sandbox (finished)",
			state: "Ended",
			start_time: "2026-01-01T08:00:00Z",
			end_time: "2026-01-01T10:00:00Z",
		},
		{
			id: "c1d2e3f4-0000-4000-8000-000000000002",
			name: "IOx Sandbox",
			state: "Ready",
			start_time: "2026-01-10T15:00:00Z",
			end_time: "2026-01-10T19:00:00Z",
		},
	];
	private readonly tokens = new Set<string>();

	constructor(
		private readonly credentials = {
			username: "dev",
			password: "secret",
			domain: "Global",
		},
	) {}

	handle(request: FakeRequest): Reply | undefined {
		if (!request.path.startsWith(`${PREFIX}/`)) return undefined;
		const path = request.path.slice(PREFIX.length);
		if (path === "/login") {
			return request.method === "PUT"
				? this.login(request)
				: this.contract.reject(request, 405, "login is PUT");
		}
		const auth = request.headers.authorization;
		if (!auth?.startsWith("Basic ")) {
			return this.contract.reject(
				request,
				401,
				"missing 'Authorization: Basic <token>' header",
			);
		}
		if (!this.tokens.has(auth.slice("Basic ".length)))
			return json(401, { message: "Token expired" });

		if (path === "/v2/sandboxes" && request.method === "GET") {
			return json(
				200,
				this.sandboxes.map(({ id, name, state }) => ({ id, name, state })),
			);
		}
		const match = /^\/v2\/sandboxes\/([^/]+)(\/extend)?$/.exec(path);
		if (!match)
			return this.contract.reject(request, 404, "no such Sandbox API route");
		const expected = match[2] ? "POST" : "GET";
		if (request.method !== expected)
			return this.contract.reject(request, 405, `expected ${expected}`);
		const sandbox = this.sandboxes.find((s) => s.id === match[1]);
		if (!sandbox) return json(404, { message: "Sandbox not found" });
		return match[2] ? this.extend(sandbox, request) : json(200, sandbox);
	}

	expireTokens(): void {
		this.tokens.clear();
	}

	private login(request: FakeRequest): Reply {
		if (contentType(request) !== "application/json") {
			return this.contract.reject(
				request,
				415,
				"login expects application/json",
			);
		}
		const body = jsonObject(request);
		if (
			!body ||
			onlyKeys(body, ["username", "password", "domain"]).length > 0 ||
			!("domain" in body)
		) {
			return this.contract.reject(
				request,
				400,
				"login body must be { username, password, domain }",
			);
		}
		const { username, password, domain } = this.credentials;
		if (
			body.username !== username ||
			body.password !== password ||
			body.domain !== domain
		) {
			return json(401, { message: "Invalid credentials" });
		}
		const token = `tok${this.tokens.size + 1}==`;
		this.tokens.add(token);
		// CloudShell returns the token as a quoted JSON string.
		return {
			status: 200,
			body: JSON.stringify(token),
			contentType: "application/json",
		};
	}

	private extend(sandbox: FakeSandbox, request: FakeRequest): Reply {
		const body =
			contentType(request) === "application/json"
				? jsonObject(request)
				: undefined;
		if (!body || onlyKeys(body, ["extended_time"]).length > 0) {
			return this.contract.reject(
				request,
				400,
				'extend body must be JSON { "extended_time": "PT..." }',
			);
		}
		const extended = String(body.extended_time ?? "");
		const parts = ISO_DURATION.exec(extended);
		if (!parts || extended === "PT")
			return json(400, { message: "Parameter is not a valid extended time" });
		const minutes = Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0);
		sandbox.end_time = new Date(Date.parse(sandbox.end_time) + minutes * 60_000)
			.toISOString()
			.replace(".000Z", "Z");
		return json(200, {
			id: sandbox.id,
			name: sandbox.name,
			start_time: sandbox.start_time,
			end_time: sandbox.end_time,
			remaining_time: extended,
		});
	}
}
