import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";
import { connectClient, jsonOf, textOf } from "../../test/fakes/connect-client";
import { InMemoryIox } from "../../test/fakes/in-memory-iox";
import { MemoryPackageFiles } from "../../test/fakes/memory-package-files";
import { AppPackager } from "../packaging/app-packager";
import { AppInsightsService } from "../services/app-insights";
import { AppLifecycleService } from "../services/app-lifecycle";

let iox: InMemoryIox;
let client: Client;

const call = (name: string, args: Record<string, unknown> = {}) =>
	client.callTool({ name, arguments: args });

beforeEach(async () => {
	iox = new InMemoryIox();
	const files = new MemoryPackageFiles({
		"app/package.yaml":
			'descriptor-schema-version: "2.2"\ninfo: { name: demo }\napp: { type: paas }\n',
	});
	client = await connectClient({
		apps: new AppLifecycleService(iox, new AppPackager(files)),
		insights: new AppInsightsService(iox),
	});
});

describe("IOx tools", () => {
	it("registers the app and insight tools", async () => {
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"activate_app",
			"deactivate_app",
			"deploy_app",
			"get_app",
			"get_app_metrics",
			"get_platform_status",
			"list_app_logs",
			"list_apps",
			"remove_app",
			"start_app",
			"stop_app",
			"tail_app_log",
		]);
	});

	it("runs the full lifecycle through tool calls", async () => {
		const deployed = await call("deploy_app", {
			appId: "demo",
			packagePath: "app",
		});
		expect(jsonOf(deployed)).toMatchObject({ app: { state: "DEPLOYED" } });
		for (const [tool, state] of [
			["activate_app", "ACTIVATED"],
			["start_app", "RUNNING"],
			["stop_app", "STOPPED"],
			["deactivate_app", "DEPLOYED"],
		] as const) {
			expect(jsonOf(await call(tool, { appId: "demo" }))).toMatchObject({
				state,
			});
		}
		expect(jsonOf(await call("remove_app", { appId: "demo" }))).toEqual({
			removed: "demo",
			steps: ["uninstalled"],
		});
		expect(jsonOf(await call("list_apps"))).toEqual([]);
	});

	it("rejects app ids IOx would refuse", async () => {
		const result = await call("get_app", { appId: "bad-id" });
		expect(result.isError).toBe(true);
		expect(textOf(result)).toMatch(/letters, numbers or underscores/);
	});

	it("turns domain failures into readable tool errors", async () => {
		iox.seed({ id: "demo", name: "demo", state: "DEPLOYED" });
		const result = await call("stop_app", { appId: "demo" });
		expect(result.isError).toBe(true);
		expect(textOf(result)).toBe(
			'Error stopping demo: Cannot stop "demo": it is DEPLOYED; stop needs RUNNING.',
		);
	});

	it("tails logs and reports metrics and platform status", async () => {
		iox.seed({ id: "py", name: "py", state: "RUNNING" });
		expect(
			textOf(
				await call("tail_app_log", {
					appId: "py",
					filename: "stdout.log",
					lines: 1,
				}),
			),
		).toBe("py/stdout.log, last 1 line(s):\nthree");
		expect(jsonOf(await call("list_app_logs", { appId: "py" }))).toHaveLength(
			1,
		);
		expect(
			jsonOf(await call("get_app_metrics", { appId: "py" })),
		).toMatchObject({
			state: "RUNNING",
			cpuPercent: 0.01,
		});
		expect(jsonOf(await call("get_platform_status"))).toMatchObject({
			allocations: { cpu: { available: 400 } },
		});
	});
});
