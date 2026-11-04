import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeCiscoServer } from "../../../test/fake-cisco/fake-cisco-server";
import { testTls } from "../../../test/fake-cisco/test-tls";
import { NotFoundError } from "../../domain/errors";
import { createTarArchive } from "../../packaging/tar-archive";
import { IoxCafApi } from "./iox-caf-api";

const fake = new FakeCiscoServer();
let port = 0;
const api = (
	overrides: Partial<ConstructorParameters<typeof IoxCafApi>[0]> = {},
) =>
	new IoxCafApi({
		baseUrl: `https://127.0.0.1:${port}/iox/api/v2/hosting`,
		username: "root",
		password: "cisco123",
		verifyTls: false,
		...overrides,
	});
const pkg = createTarArchive([
	{ path: "package.yaml", data: new TextEncoder().encode("info: {}\n") },
]);

beforeAll(async () => {
	port = await fake.start({ tls: testTls() });
});
afterAll(() => fake.stop());

describe("IoxCafApi against a fake CAF over HTTPS", () => {
	it("gets a token with Basic auth and sends it as X-Token-Id", async () => {
		await expect(api().platformInfo()).resolves.toMatchObject({
			product_id: "IR1101-K9",
		});
		const call = fake.requests.find((r) =>
			r.path.endsWith("/platform/sysinfo"),
		);
		expect(call?.headers["x-token-id"]).toMatch(/^token-\d+$/);
	});

	it("rejects the self-signed certificate when IOX_TLS_VERIFY is on", async () => {
		await expect(api({ verifyTls: true }).platformInfo()).rejects.toThrow(
			/unreachable/,
		);
	});

	it("installs, drives the lifecycle and uninstalls an app", async () => {
		const client = api();
		await client.installApp("demo_app", pkg);
		expect(fake.iox.apps.get("demo_app")?.packageFiles).toEqual([
			"package.yaml",
		]);
		await client.changeState("demo_app", "activate", { profile: "c1.tiny" });
		await client.changeState("demo_app", "start");
		await expect(client.getApp("demo_app")).resolves.toMatchObject({
			id: "demo_app",
			state: "RUNNING",
			resources: { profile: "c1.tiny", cpu: 100, memory: 32 },
		});
		await expect(client.listApps()).resolves.toHaveLength(1);
		await client.changeState("demo_app", "stop");
		await client.changeState("demo_app", "deactivate");
		await client.deleteApp("demo_app");
		await expect(client.listApps()).resolves.toEqual([]);
	});

	it("maps a 404 for an app to NotFoundError", async () => {
		await expect(api().getApp("ghost")).rejects.toBeInstanceOf(NotFoundError);
	});

	it("surfaces CAF's error description", async () => {
		const client = api();
		await client.installApp("busy_app", pkg);
		await expect(client.changeState("busy_app", "stop")).rejects.toThrow(
			"IOx CAF API returned HTTP 409: Cannot stop app in state DEPLOYED",
		);
	});

	it("lists logs and downloads one through its relative link", async () => {
		const client = api();
		const [first] = await client.listLogs("busy_app");
		expect(first).toMatchObject({
			filename: "stdout.log",
			downloadLink: expect.any(String),
		});
		const text = await client.downloadLog(first?.downloadLink ?? "");
		expect(text.split("\n")).toHaveLength(5);
	});

	it("refuses log links that point at another host", async () => {
		await expect(
			api().downloadLog("https://evil.example/logs"),
		).rejects.toThrow(/another host/);
	});

	it("reads metrics, resource profiles and allocations", async () => {
		const client = api();
		await expect(client.appMetrics("busy_app")).resolves.toEqual({
			appId: "busy_app",
			memoryKb: 0,
			cpuPercent: 0,
			networkBytes: 0,
			diskMb: 0.03,
		});
		const profiles = await client.resourceProfiles();
		expect(profiles.find((p) => p.name === "c1.small")).toEqual({
			name: "c1.small",
			cpu: 200,
			memory: 64,
		});
		await expect(client.resourceAllocations()).resolves.toMatchObject({
			cpu: { total: 1000, available: 1000 },
		});
	});

	it("re-authenticates once when the token expires", async () => {
		const client = api();
		await client.listApps();
		fake.iox.expireTokens();
		await expect(client.listApps()).resolves.toBeDefined();
	});

	it("reports wrong credentials on login", async () => {
		await expect(api({ password: "nope" }).listApps()).rejects.toThrow(
			"IOx CAF API login returned HTTP 401: Bad credentials",
		);
	});
});
