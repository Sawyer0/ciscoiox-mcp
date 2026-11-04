import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeCiscoServer } from "../fake-cisco/fake-cisco-server";
import { readTarEntries } from "../fake-cisco/tar-entries";
import { testTls } from "../fake-cisco/test-tls";

/**
 * Spawns the real server (`bun src/index.ts`) over stdio, exactly as an MCP
 * client such as Claude Desktop would, and drives every tool against a local
 * fake of the DevNet Quali portal and an IOx device.
 */
const ROOT = resolve(import.meta.dirname, "../..");
const ENTRY = join(ROOT, "src/index.ts");
const FIXTURE_APP = join(ROOT, "test/fixtures/hello-app");
const BUN = process.env.BUN_BIN ?? "bun";
const READY_LAB = "c1d2e3f4-0000-4000-8000-000000000002";

const quali = new FakeCiscoServer();
const iox = new FakeCiscoServer();
let client: Client;
let serverLog = "";
const protocolErrors: Error[] = [];

const call = async (name: string, args: Record<string, unknown> = {}) => {
	const result = await client.callTool({ name, arguments: args });
	const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
	return { isError: result.isError === true, text };
};
const json = async (name: string, args: Record<string, unknown> = {}) => {
	const { isError, text } = await call(name, args);
	expect(isError, text).toBe(false);
	return JSON.parse(text);
};

beforeAll(async () => {
	const [qualiPort, ioxPort] = await Promise.all([
		quali.start(),
		iox.start({ tls: testTls() }),
	]);
	// Configure through a .env file in the working directory to prove dotenv
	// loads it without writing anything to stdout, which carries the protocol.
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
		command: BUN,
		args: [ENTRY],
		cwd,
		env: {
			PATH: process.env.PATH ?? "",
			NO_PROXY: "127.0.0.1",
			no_proxy: "127.0.0.1",
		},
		stderr: "pipe",
	});
	transport.stderr?.on("data", (chunk: Buffer) => {
		serverLog += chunk.toString();
	});
	client = new Client({ name: "e2e", version: "1.0.0" });
	client.onerror = (error) => protocolErrors.push(error);
	await client.connect(transport);
}, 30_000);

afterAll(async () => {
	await client?.close();
	await Promise.all([quali.stop(), iox.stop()]);
});

describe("ciscoiox-mcp over stdio", () => {
	it("announces itself and lists all 14 tools", async () => {
		expect(client.getServerVersion()?.name).toBe("ciscoiox-mcp");
		const { tools } = await client.listTools();
		expect(tools).toHaveLength(14);
		expect(serverLog).toContain("tools: lab, apps, insights");
		// Anything but JSON-RPC on stdout (e.g. a library banner) shows up here.
		expect(protocolErrors).toEqual([]);
	});

	it("reads and extends the lab reservation", async () => {
		const status = await json("get_reservation_status");
		expect(status).toMatchObject({
			id: READY_LAB,
			state: "Ready",
			endTime: "2026-01-10T19:00:00Z",
		});
		const extended = await json("extend_reservation", { minutes: 90 });
		expect(extended).toMatchObject({
			endTime: "2026-01-10T20:30:00Z",
			remainingTime: "PT1H30M",
		});
	});

	it("reports platform capacity", async () => {
		const status = await json("get_platform_status");
		expect(status.info).toMatchObject({ product_id: "IR1101-K9" });
		expect(status.allocations.cpu).toEqual({ total: 1000, available: 1000 });
	});

	it("packages a directory, deploys, activates and starts it", async () => {
		const result = await json("deploy_app", {
			appId: "hello_iox",
			packagePath: FIXTURE_APP,
			start: true,
		});
		expect(result.steps).toEqual([
			'installed 2 file(s) as "hello_iox"',
			"activated",
			"started",
		]);
		expect(result.app).toMatchObject({ id: "hello_iox", state: "RUNNING" });
		const upload = iox.requests.find(
			(r) => r.method === "POST" && r.path.endsWith("/apps"),
		);
		expect(
			readTarEntries(upload?.body ?? Buffer.alloc(0)).map((e) => e.path),
		).toEqual(["package.yaml", "app/main.py"]);
		expect((await json("list_apps")).map((a: { id: string }) => a.id)).toEqual([
			"hello_iox",
		]);
		expect(await json("get_app", { appId: "hello_iox" })).toMatchObject({
			resources: { profile: "c1.small", cpu: 200, memory: 64, disk: 10 },
		});
	});

	it("tails logs and reads metrics of the running app", async () => {
		const logs = await json("list_app_logs", { appId: "hello_iox" });
		expect(logs.map((l: { filename: string }) => l.filename)).toEqual([
			"stdout.log",
			"watchDog.log",
		]);
		const tail = await call("tail_app_log", {
			appId: "hello_iox",
			filename: "stdout.log",
			lines: 2,
		});
		expect(tail.text).toBe(
			"hello_iox/stdout.log, last 2 line(s):\nhello_iox stdout.log line 4\nhello_iox stdout.log line 5",
		);
		expect(await json("get_app_metrics", { appId: "hello_iox" })).toMatchObject(
			{
				state: "RUNNING",
				memoryKb: 6688,
			},
		);
	});

	it("walks the lifecycle by hand and refuses invalid steps", async () => {
		expect(await json("stop_app", { appId: "hello_iox" })).toMatchObject({
			state: "STOPPED",
		});
		expect(await json("start_app", { appId: "hello_iox" })).toMatchObject({
			state: "RUNNING",
		});
		const bad = await call("activate_app", { appId: "hello_iox" });
		expect(bad).toEqual({
			isError: true,
			text: 'Error activating hello_iox: Cannot activate "hello_iox": it is RUNNING; activate needs DEPLOYED.',
		});
		expect(await json("stop_app", { appId: "hello_iox" })).toMatchObject({
			state: "STOPPED",
		});
		expect(await json("deactivate_app", { appId: "hello_iox" })).toMatchObject({
			state: "DEPLOYED",
		});
		expect(
			await json("activate_app", {
				appId: "hello_iox",
				resources: { profile: "c1.tiny" },
			}),
		).toMatchObject({
			state: "ACTIVATED",
			resources: { cpu: 100, memory: 32 },
		});
	});

	it("blocks activation the device has no room for", async () => {
		await json("deploy_app", { appId: "big_app", packagePath: FIXTURE_APP });
		const result = await call("activate_app", {
			appId: "big_app",
			resources: { profile: "custom", cpu: 2000, memory: 64 },
		});
		expect(result.isError).toBe(true);
		expect(result.text).toMatch(/CPU: needs 2000 units, 900 units available/);
	});

	it("removes apps, forcing through stop and deactivate when asked", async () => {
		await json("start_app", { appId: "hello_iox" });
		expect((await call("remove_app", { appId: "hello_iox" })).text).toMatch(
			/force: true/,
		);
		expect(
			await json("remove_app", { appId: "hello_iox", force: true }),
		).toEqual({
			removed: "hello_iox",
			steps: ["stopped", "deactivated", "uninstalled"],
		});
		expect(await json("remove_app", { appId: "big_app" })).toMatchObject({
			steps: ["uninstalled"],
		});
		expect(await json("list_apps")).toEqual([]);
	});

	it("reports a missing app as a tool error, not a crash", async () => {
		expect(await call("get_app", { appId: "ghost" })).toEqual({
			isError: true,
			text: 'Error reading app ghost: IOx app "ghost" was not found on the device.',
		});
	});
});

describe("startup without configuration", () => {
	it("exits non-zero with a readable message and nothing on stdout", () => {
		const cwd = mkdtempSync(join(tmpdir(), "ciscoiox-empty-"));
		const run = spawnSync(BUN, [ENTRY], {
			cwd,
			env: { PATH: process.env.PATH ?? "" },
			encoding: "utf8",
			timeout: 15_000,
		});
		expect(run.status).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Nothing to serve: set QUALI_PORTAL_HOST");
	});
});
