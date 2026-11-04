import { type FakeRequest, json, parseJson, type Reply } from "./http-kit";

interface FakeSandbox {
	id: string;
	name: string;
	state: string;
	start_time: string;
	end_time: string;
}

const PREFIX = "/api";
const ISO_DURATION = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;

/**
 * Fake of the CloudShell Sandbox API v2, shaped after help.quali.com
 * (login, sandboxes, sandbox details, sandbox extend).
 */
export class FakeQuali {
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
		if (path === "/login" && request.method === "PUT")
			return this.login(request);
		if (!this.isAuthorized(request))
			return json(401, { message: "Unauthorized" });

		if (path === "/v2/sandboxes" && request.method === "GET") {
			return json(
				200,
				this.sandboxes.map(({ id, name, state }) => ({ id, name, state })),
			);
		}
		const match = /^\/v2\/sandboxes\/([^/]+)(\/extend)?$/.exec(path);
		const sandbox = this.sandboxes.find((s) => s.id === match?.[1]);
		if (!match || !sandbox) return json(404, { message: "Sandbox not found" });
		if (!match[2] && request.method === "GET") return json(200, sandbox);
		if (match[2] && request.method === "POST")
			return this.extend(sandbox, request);
		return json(405, { message: "Method not allowed" });
	}

	private login(request: FakeRequest): Reply {
		const body = parseJson(request);
		const ok =
			body.username === this.credentials.username &&
			body.password === this.credentials.password &&
			body.domain === this.credentials.domain;
		if (!ok) return json(401, { message: "Invalid credentials" });
		const token = `tok${this.tokens.size + 1}==`;
		this.tokens.add(token);
		// CloudShell returns the token as a quoted JSON string.
		return {
			status: 200,
			body: JSON.stringify(token),
			contentType: "application/json",
		};
	}

	expireTokens(): void {
		this.tokens.clear();
	}

	private isAuthorized(request: FakeRequest): boolean {
		const header = request.headers.authorization ?? "";
		return (
			header.startsWith("Basic ") &&
			this.tokens.has(header.slice("Basic ".length))
		);
	}

	private extend(sandbox: FakeSandbox, request: FakeRequest): Reply {
		const extended = String(parseJson(request).extended_time ?? "");
		const parts = ISO_DURATION.exec(extended);
		if (!parts || extended === "PT") {
			return json(400, { message: "Parameter is not a valid extended time" });
		}
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
