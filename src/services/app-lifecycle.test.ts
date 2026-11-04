import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryIox } from "../../test/fakes/in-memory-iox";
import { MemoryPackageFiles } from "../../test/fakes/memory-package-files";
import { InvalidStateError, QuotaExceededError } from "../domain/errors";
import { AppPackager } from "../packaging/app-packager";
import { AppLifecycleService } from "./app-lifecycle";

const descriptor = (profile: string) => `descriptor-schema-version: "2.2"
info: { name: demo }
app: { type: paas, resources: { profile: ${profile}, disk: 10 } }
`;

let iox: InMemoryIox;
let service: AppLifecycleService;

beforeEach(() => {
	iox = new InMemoryIox();
	const files = new MemoryPackageFiles({
		"small/package.yaml": descriptor("c1.small"),
		"small/main.py": "print(1)",
		"large/package.yaml": descriptor("c1.large"),
	});
	service = new AppLifecycleService(iox, new AppPackager(files));
});

describe("AppLifecycleService.deploy", () => {
	it("packages, installs, activates with the descriptor's resources and starts", async () => {
		const result = await service.deploy({
			appId: "demo",
			packagePath: "small",
			start: true,
		});
		expect(result.steps).toEqual([
			'installed 2 file(s) as "demo"',
			"activated",
			"started",
		]);
		expect(result.app.state).toBe("RUNNING");
		expect(iox.calls).toEqual([
			"install demo",
			'activate demo {"profile":"c1.small","disk":10}',
			"start demo",
		]);
	});

	it("only installs when activation is not requested", async () => {
		const result = await service.deploy({
			appId: "demo",
			packagePath: "small",
		});
		expect(result.app.state).toBe("DEPLOYED");
		expect(iox.calls).toEqual(["install demo"]);
	});

	it("checks capacity before uploading anything", async () => {
		await expect(
			service.deploy({ appId: "big", packagePath: "large", activate: true }),
		).rejects.toThrow(QuotaExceededError);
		expect(iox.calls).toEqual([]);
	});

	it("refuses to overwrite an installed app", async () => {
		iox.seed({ id: "demo", name: "demo", state: "RUNNING" });
		await expect(
			service.deploy({ appId: "demo", packagePath: "small" }),
		).rejects.toThrow(/already installed/);
	});
});

describe("AppLifecycleService lifecycle", () => {
	it("walks an app through activate, start, stop and deactivate", async () => {
		iox.seed({ id: "demo", name: "demo", state: "DEPLOYED" });
		expect(
			(await service.activate("demo", { profile: "c1.small" })).state,
		).toBe("ACTIVATED");
		expect((await service.start("demo")).state).toBe("RUNNING");
		expect((await service.stop("demo")).state).toBe("STOPPED");
		expect((await service.deactivate("demo")).state).toBe("DEPLOYED");
	});

	it("explains an invalid transition without calling the device", async () => {
		iox.seed({ id: "demo", name: "demo", state: "DEPLOYED" });
		await expect(service.start("demo")).rejects.toThrow(
			new InvalidStateError(
				'Cannot start "demo": it is DEPLOYED; start needs ACTIVATED or STOPPED.',
			),
		);
		expect(iox.calls).toEqual([]);
	});

	it("blocks activation that exceeds free capacity", async () => {
		iox.seed({ id: "demo", name: "demo", state: "DEPLOYED" });
		await expect(
			service.activate("demo", { profile: "c1.large" }),
		).rejects.toThrow(/CPU: needs 600 units, 400 units available/);
	});
});

describe("AppLifecycleService.remove", () => {
	it("deletes a deployed app directly", async () => {
		iox.seed({ id: "demo", name: "demo", state: "DEPLOYED" });
		await expect(service.remove("demo")).resolves.toEqual({
			removed: "demo",
			steps: ["uninstalled"],
		});
	});

	it("requires force for a running app, then stops and deactivates it first", async () => {
		iox.seed({ id: "demo", name: "demo", state: "RUNNING" });
		await expect(service.remove("demo")).rejects.toThrow(/force: true/);
		const result = await service.remove("demo", true);
		expect(result.steps).toEqual(["stopped", "deactivated", "uninstalled"]);
		await expect(service.listApps()).resolves.toEqual([]);
	});
});
