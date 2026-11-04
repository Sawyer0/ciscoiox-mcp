import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { E2eHarness, FIXTURE_APP, READY_LAB } from "./harness";

/**
 * One continuous session, the way a developer would use the server from an
 * AI assistant: check the lab, keep it alive, ship hello-app to the device,
 * watch it run, then tear it down. Each step asserts what the fake portal
 * and fake device now hold, not just what the tool replied.
 */
const h = new E2eHarness();
const device = () => h.device.iox;

beforeAll(() => h.start(), 30_000);
afterAll(() => h.stop());

it("runs the full sandbox workflow end to end", async () => {
	// 1. Inspect the reservation and extend it.
	const lab = await h.json<{ id: string; state: string; endTime: string }>(
		"get_reservation_status",
	);
	expect(lab).toMatchObject({ id: READY_LAB, state: "Ready" });
	await h.json("extend_reservation", { minutes: 30 });
	expect(h.quali.quali.sandboxes[1]?.end_time).toBe("2026-01-10T19:30:00Z");

	// 2. Check the device has room.
	const before = await h.json<{ allocations: { cpu: { available: number } } }>(
		"get_platform_status",
	);
	expect(before.allocations.cpu.available).toBe(1000);

	// 3. Package hello-app from its directory and install it.
	const deployed = await h.json<{ steps: string[]; packagedFiles: string[] }>(
		"deploy_app",
		{ appId: "hello_iox", packagePath: FIXTURE_APP },
	);
	expect(deployed.steps).toEqual(['installed 2 file(s) as "hello_iox"']);
	expect(device().apps.get("hello_iox")?.state).toBe("DEPLOYED");

	// The bytes on the wire are a real tar archive: list and extract them with
	// the system tar and compare every file with the fixture byte for byte.
	const scratch = mkdtempSync(join(tmpdir(), "uploaded-"));
	const archive = join(scratch, "package.tar");
	writeFileSync(archive, h.lastUpload());
	const listing = execFileSync("tar", ["-tf", archive], { encoding: "utf8" });
	expect(listing.trim().split("\n")).toEqual(["package.yaml", "app/main.py"]);
	execFileSync("tar", ["-xf", archive, "-C", scratch]);
	for (const file of ["package.yaml", "app/main.py"]) {
		expect(readFileSync(join(scratch, file))).toEqual(
			readFileSync(join(FIXTURE_APP, file)),
		);
	}

	// 4. Activate with the descriptor's profile, then start.
	await h.json("activate_app", { appId: "hello_iox" });
	expect(device().apps.get("hello_iox")?.reserved).toEqual({
		profile: "c1.small",
		cpu: 200,
		memory: 64,
		disk: 10,
	});
	await h.json("start_app", { appId: "hello_iox" });
	expect(device().apps.get("hello_iox")?.state).toBe("RUNNING");

	// 5. Observe it running.
	const metrics = await h.json<{
		state: string;
		memoryKb: number;
		cpuPercent: number;
	}>("get_app_metrics", { appId: "hello_iox" });
	expect(metrics).toMatchObject({
		state: "RUNNING",
		memoryKb: 6400,
		cpuPercent: 1.5,
	});
	const logs = await h.json<Array<{ filename: string }>>("list_app_logs", {
		appId: "hello_iox",
	});
	expect(logs.map((l) => l.filename)).toContain("stdout.log");
	const stdout = await h.call("tail_app_log", {
		appId: "hello_iox",
		filename: "stdout.log",
		lines: 1,
	});
	expect(stdout.text).toBe(
		"hello_iox/stdout.log, last 1 line(s):\nhello_iox says hello #3",
	);

	// 6. Stop, deactivate and uninstall, checking the device after each step.
	await h.json("stop_app", { appId: "hello_iox" });
	expect(device().apps.get("hello_iox")?.state).toBe("STOPPED");
	await h.json("deactivate_app", { appId: "hello_iox" });
	expect(device().apps.get("hello_iox")?.state).toBe("DEPLOYED");
	const after = await h.json<{ allocations: { cpu: { available: number } } }>(
		"get_platform_status",
	);
	expect(after.allocations.cpu.available).toBe(1000);
	await h.json("remove_app", { appId: "hello_iox" });
	expect(device().apps.has("hello_iox")).toBe(false);
	expect(await h.json("list_apps")).toEqual([]);

	// The device saw the documented state machine, in order.
	const stateCalls = h.device.requests
		.filter((r) => r.path.endsWith("/state"))
		.map((r) => r.query.get("action"));
	expect(stateCalls).toEqual(["activate", "start", "stop", "deactivate"]);

	// Nothing the server sent broke the fakes' contracts.
	expect(h.violations).toEqual([]);
	expect(h.protocolErrors).toEqual([]);
});
