import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { E2eHarness, FIXTURE_APP, READY_LAB } from "./harness";

/** Every MCP tool, called through a real MCP client against the spawned server. */
const h = new E2eHarness();
const app = (id: string) => h.device.iox.apps.get(id);
type Status = {
	info: Record<string, string>;
	allocations: { cpu: { total: number; available: number } };
	profiles: Array<{ name: string }>;
};
const freeCpu = async () =>
	(await h.json<Status>("get_platform_status")).allocations.cpu.available;

beforeAll(() => h.start(), 30_000);
afterAll(() => h.stop());
afterEach(() => {
	expect(h.violations).toEqual([]);
	expect(h.protocolErrors).toEqual([]);
});

describe("lab tools", () => {
	it("get_reservation_status returns the Ready lab with real times", async () => {
		expect(await h.json("get_reservation_status")).toMatchObject({
			id: READY_LAB,
			name: "IOx Sandbox",
			state: "Ready",
			startTime: "2026-01-10T15:00:00Z",
			endTime: "2026-01-10T19:00:00Z",
		});
	});

	it("extend_reservation moves the portal's end_time", async () => {
		expect(await h.json("extend_reservation", { minutes: 90 })).toMatchObject({
			endTime: "2026-01-10T20:30:00Z",
			remainingTime: "PT1H30M",
		});
		expect(h.quali.quali.sandboxes[1]?.end_time).toBe("2026-01-10T20:30:00Z");
	});

	it("rejects invalid input as an MCP error", async () => {
		const result = await h.call("extend_reservation", { minutes: -5 });
		expect(result.isError).toBe(true);
		expect(h.quali.quali.sandboxes[1]?.end_time).toBe("2026-01-10T20:30:00Z");
	});
});

describe("IOx tools", () => {
	it("get_platform_status reports device info, capacity and profiles", async () => {
		const status = await h.json<Status>("get_platform_status");
		expect(status.info.product_id).toBe("IR1101-K9");
		expect(status.allocations.cpu).toEqual({ total: 1000, available: 1000 });
		expect(status.profiles.map((p) => p.name)).toContain("c1.small");
	});

	it("deploy_app uploads the packaged fixture and the device parses its descriptor", async () => {
		const result = await h.json("deploy_app", {
			appId: "hello_iox",
			packagePath: FIXTURE_APP,
		});
		expect(result).toMatchObject({
			app: {
				id: "hello_iox",
				name: "hello_iox",
				state: "DEPLOYED",
				version: "1.0",
			},
		});
		expect(app("hello_iox")?.pkg).toEqual({
			files: ["package.yaml", "app/main.py"],
			name: "hello_iox",
			version: "1.0",
			appType: "paas",
			resources: { profile: "c1.small", disk: 10 },
		});
	});

	it("list_apps and get_app reflect the device", async () => {
		const apps = await h.json<Array<{ id: string }>>("list_apps");
		expect(apps.map((a) => a.id)).toEqual(["hello_iox"]);
		expect(await h.json("get_app", { appId: "hello_iox" })).toMatchObject({
			state: "DEPLOYED",
			resources: { profile: "c1.small", cpu: 200, memory: 64, disk: 10 },
		});
	});

	it("activate_app reserves the requested profile on the device", async () => {
		const activated = await h.json("activate_app", {
			appId: "hello_iox",
			resources: { profile: "c1.medium" },
		});
		expect(activated).toMatchObject({ state: "ACTIVATED" });
		expect(app("hello_iox")?.reserved).toEqual({
			profile: "c1.medium",
			cpu: 400,
			memory: 128,
			disk: 10,
		});
		expect(await freeCpu()).toBe(600);
	});

	it("start_app leaves the app RUNNING on the device", async () => {
		expect(await h.json("start_app", { appId: "hello_iox" })).toMatchObject({
			state: "RUNNING",
		});
		expect(app("hello_iox")?.state).toBe("RUNNING");
	});

	it("get_app_metrics returns live usage fields", async () => {
		expect(await h.json("get_app_metrics", { appId: "hello_iox" })).toEqual({
			appId: "hello_iox",
			state: "RUNNING",
			memoryKb: 12800,
			cpuPercent: 1.5,
			networkBytes: 99601,
			diskMb: 0.03,
		});
	});

	it("list_app_logs and tail_app_log return the device's log content", async () => {
		const logs = await h.json<
			Array<{ filename: string; sizeBytes: number; timestamp: string }>
		>("list_app_logs", { appId: "hello_iox" });
		expect(logs.map((l) => l.filename)).toEqual(["stdout.log", "watchDog.log"]);
		expect(logs[0]?.sizeBytes).toBeGreaterThan(0);
		expect(logs[0]?.timestamp).toBe("Sat Jan 10 17:00:00 2026");
		const tail = await h.call("tail_app_log", {
			appId: "hello_iox",
			filename: "watchDog.log",
			lines: 2,
		});
		expect(tail.text).toBe(
			"hello_iox/watchDog.log, last 2 line(s):\n2: hello_iox entered ACTIVATED\n3: hello_iox entered RUNNING",
		);
	});

	it("stop_app and deactivate_app release resources on the device", async () => {
		expect(await h.json("stop_app", { appId: "hello_iox" })).toMatchObject({
			state: "STOPPED",
		});
		expect(
			await h.json("deactivate_app", { appId: "hello_iox" }),
		).toMatchObject({
			state: "DEPLOYED",
		});
		expect(await freeCpu()).toBe(1000);
	});

	it("remove_app uninstalls from the device", async () => {
		expect(await h.json("remove_app", { appId: "hello_iox" })).toEqual({
			removed: "hello_iox",
			steps: ["uninstalled"],
		});
		expect(app("hello_iox")).toBeUndefined();
	});
});

describe("errors surface as MCP tool errors", () => {
	it("an unknown app", async () => {
		expect(await h.call("get_app", { appId: "ghost" })).toEqual({
			isError: true,
			text: 'Error reading app ghost: IOx app "ghost" was not found on the device.',
		});
	});

	it("an invalid lifecycle step, without changing the device", async () => {
		await h.json("deploy_app", { appId: "idle_app", packagePath: FIXTURE_APP });
		const before = h.device.requests.length;
		expect(await h.call("stop_app", { appId: "idle_app" })).toEqual({
			isError: true,
			text: 'Error stopping idle_app: Cannot stop "idle_app": it is DEPLOYED; stop needs RUNNING.',
		});
		const sent = h.device.requests.slice(before).map((r) => r.method);
		expect(sent.every((method) => method === "GET")).toBe(true);
	});

	it("activation beyond free capacity", async () => {
		const result = await h.call("activate_app", {
			appId: "idle_app",
			resources: { profile: "custom", cpu: 5000 },
		});
		expect(result.isError).toBe(true);
		expect(result.text).toMatch(
			/Not enough free resources on the device \(CPU: needs 5000 units, 1000 units available\)/,
		);
		expect(app("idle_app")?.state).toBe("DEPLOYED");
	});

	it("an unknown resource profile", async () => {
		const result = await h.call("activate_app", {
			appId: "idle_app",
			resources: { profile: "c9.huge" },
		});
		expect(result.isError).toBe(true);
		expect(result.text).toMatch(
			/Unknown resource profile "c9.huge". This device offers: default, c1.tiny/,
		);
	});

	it("a bad package path and an invalid app id", async () => {
		expect(
			await h.call("deploy_app", {
				appId: "x",
				packagePath: "/does/not/exist",
			}),
		).toEqual({
			isError: true,
			text: "Error deploying x: Package path not found: /does/not/exist",
		});
		const badId = await h.call("deploy_app", {
			appId: "bad-id",
			packagePath: FIXTURE_APP,
		});
		expect(badId.isError).toBe(true);
	});

	it("a log that does not exist", async () => {
		const result = await h.call("tail_app_log", {
			appId: "idle_app",
			filename: "nope.log",
		});
		expect(result.isError).toBe(true);
		expect(result.text).toMatch(
			/has no log named "nope.log". Available: stdout.log, watchDog.log/,
		);
	});

	it("removing a running app needs force, which stops and deactivates it", async () => {
		await h.json("activate_app", { appId: "idle_app" });
		await h.json("start_app", { appId: "idle_app" });
		const refused = await h.call("remove_app", { appId: "idle_app" });
		expect(refused.isError).toBe(true);
		expect(refused.text).toMatch(/is RUNNING.*force: true/);
		expect(app("idle_app")?.state).toBe("RUNNING");
		expect(
			await h.json("remove_app", { appId: "idle_app", force: true }),
		).toMatchObject({ steps: ["stopped", "deactivated", "uninstalled"] });
		expect(app("idle_app")).toBeUndefined();
	});
});

describe("coverage of the tool surface", () => {
	it("exercised every tool the server lists", async () => {
		const { tools } = await h.client.listTools();
		expect(tools).toHaveLength(14);
		expect([...h.calledTools].sort()).toEqual(tools.map((t) => t.name).sort());
		expect(h.serverLog).toContain("tools: lab, apps, insights");
	});
});
