import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { FakeCiscoServer } from "../fake-cisco/fake-cisco-server";
import { testTls } from "../fake-cisco/test-tls";

export const ROOT = resolve(import.meta.dirname, "../..");
export const FIXTURE_APP = join(ROOT, "test/fixtures/hello-app");
export const READY_LAB = "c1d2e3f4-0000-4000-8000-000000000002";

/**
 * How the suite launches the server, picked by E2E_RUNTIME: `bun` (default)
 * runs the TypeScript source, `node` runs the built bundle, the same way an
 * MCP client would with `node dist/index.js` or `npx`.
 */
export interface ServerCommand {
	command: string;
	args: string[];
}

export function serverCommand(
	runtime = process.env.E2E_RUNTIME ?? "bun",
): ServerCommand {
	if (runtime === "bun") {
		return {
			command: process.env.BUN_BIN ?? "bun",
			args: [join(ROOT, "src/index.ts")],
		};
	}
	if (runtime === "node") {
		const entry = join(ROOT, "dist/index.js");
		if (!existsSync(entry)) {
			throw new Error(`${entry} is missing; run the build first`);
		}
		return { command: process.env.NODE_BIN ?? "node", args: [entry] };
	}
	throw new Error(`E2E_RUNTIME must be bun or node, got "${runtime}"`);
}

export const SERVER = serverCommand();
export interface ToolOutcome {
	isError: boolean;
	text: string;
}

/**
 * Runs the real server (see SERVER) as a child process over stdio,
 * exactly as Claude Desktop or Cursor would, against a fake DevNet Quali
 * portal (HTTP) and a fake IOx device (HTTPS, self-signed).
 */
export class E2eHarness {
	readonly quali = new FakeCiscoServer();
	readonly device = new FakeCiscoServer();
	readonly calledTools = new Set<string>();
	readonly protocolErrors: Error[] = [];
	serverLog = "";
	client!: Client;

	async start(): Promise<void> {
		const [qualiPort, ioxPort] = await Promise.all([
			this.quali.start(),
			this.device.start({ tls: testTls() }),
		]);
		// Configure through a .env file in the working directory, which also
		// proves dotenv loads it without printing to stdout (the protocol channel).
		const cwd = mkdtempSync(join(tmpdir(), "ciscoiox-e2e-"));
		writeFileSync(
			join(cwd, ".env"),
			[
				"QUALI_PORTAL_HOST=127.0.0.1",
				`QUALI_PORTAL_PORT=${qualiPort}`,
				"QUALI_USER=dev",
				"QUALI_PASS=secret",
				"IOX_HOST=127.0.0.1",
				`IOX_PORT=${ioxPort}`,
				"IOX_USER=root",
				"IOX_PASS=cisco123",
			].join("\n"),
		);
		const transport = new StdioClientTransport({
			command: SERVER.command,
			args: SERVER.args,
			cwd,
			env: {
				PATH: process.env.PATH ?? "",
				NO_PROXY: "127.0.0.1",
				no_proxy: "127.0.0.1",
			},
			stderr: "pipe",
		});
		transport.stderr?.on("data", (chunk: Buffer) => {
			this.serverLog += chunk.toString();
		});
		this.client = new Client({ name: "e2e", version: "1.0.0" });
		this.client.onerror = (error) => this.protocolErrors.push(error);
		await this.client.connect(transport);
	}

	async stop(): Promise<void> {
		await this.client?.close();
		await Promise.all([this.quali.stop(), this.device.stop()]);
	}

	/** Contract violations seen by either fake; must stay empty. */
	get violations(): string[] {
		return [...this.quali.violations, ...this.device.violations];
	}

	async call(
		name: string,
		args: Record<string, unknown> = {},
	): Promise<ToolOutcome> {
		this.calledTools.add(name);
		const result = await this.client.callTool({ name, arguments: args });
		const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
		return { isError: result.isError === true, text };
	}

	/** Calls a tool that must succeed and returns its JSON payload. */
	async json<T = Record<string, unknown>>(
		name: string,
		args: Record<string, unknown> = {},
	): Promise<T> {
		const { isError, text } = await this.call(name, args);
		if (isError) throw new Error(`${name} failed: ${text}`);
		return JSON.parse(text) as T;
	}

	/** The most recent package upload the fake device received. */
	lastUpload(): Buffer {
		const upload = this.device.requests
			.filter((r) => r.method === "POST" && r.path.endsWith("/hosting/apps"))
			.at(-1);
		if (!upload) throw new Error("no package was uploaded");
		return upload.body;
	}
}
