import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTarArchive } from "../../src/packaging/tar-archive";
import { FakeCiscoServer } from "./fake-cisco-server";

/**
 * The fakes are only worth something if they reject what a real device or
 * portal would. These tests send contract-breaking requests directly and
 * check each one is refused and recorded as a violation.
 */
const fake = new FakeCiscoServer();
let base = "";
const IOX = "/iox/api/v2/hosting";
const basic = (user: string, pass: string) =>
	`Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

const send = (path: string, init: RequestInit = {}) =>
	fetch(`${base}${path}`, init);
const ioxToken = async () => {
	const res = await send(`${IOX}/tokenservice`, {
		method: "POST",
		headers: { Authorization: basic("root", "cisco123") },
	});
	return ((await res.json()) as { token: { id: string } }).token.id;
};
const qualiToken = async () => {
	const res = await send("/api/login", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			username: "dev",
			password: "secret",
			domain: "Global",
		}),
	});
	return JSON.parse(await res.text()) as string;
};
const validPackage = () =>
	createTarArchive([
		{
			path: "package.yaml",
			data: new TextEncoder().encode(
				"info: { name: a }\napp: { type: paas }\n",
			),
		},
	]);

beforeAll(async () => {
	base = `http://127.0.0.1:${await fake.start()}`;
});
afterAll(() => fake.stop());
beforeEach(() => {
	fake.quali.contract.violations.length = 0;
	fake.iox.contract.violations.length = 0;
});

describe("fake CAF strictness", () => {
	it("rejects calls without X-Token-Id", async () => {
		expect((await send(`${IOX}/apps`)).status).toBe(401);
		expect(fake.violations).toEqual([
			`GET ${IOX}/apps: missing X-Token-Id header`,
		]);
	});

	it("rejects unknown routes and wrong methods", async () => {
		const headers = { "X-Token-Id": await ioxToken() };
		expect((await send(`${IOX}/api/v1/info`, { headers })).status).toBe(404);
		expect(
			(await send(`${IOX}/apps/x/logs`, { method: "DELETE", headers })).status,
		).toBe(405);
		expect(fake.violations).toHaveLength(2);
	});

	it("rejects installs with the wrong content type, app id or package", async () => {
		const token = await ioxToken();
		const install = (
			headers: Record<string, string>,
			body: Uint8Array | string,
		) =>
			send(`${IOX}/apps`, {
				method: "POST",
				headers: { "X-Token-Id": token, ...headers },
				body: typeof body === "string" ? body : Buffer.from(body),
			});
		const octet = { "Content-Type": "application/octet-stream" };
		expect((await install({ ...octet }, validPackage())).status).toBe(400);
		expect(
			(
				await install(
					{ "Content-Type": "application/json", "X-App-Id": "a" },
					validPackage(),
				)
			).status,
		).toBe(415);
		expect(
			(await install({ ...octet, "X-App-Id": "a" }, "not a tar")).status,
		).toBe(400);
		const noDescriptor = createTarArchive([
			{ path: "main.py", data: new Uint8Array(1) },
		]);
		expect(
			(await install({ ...octet, "X-App-Id": "a" }, noDescriptor)).status,
		).toBe(400);
		expect(fake.violations).toHaveLength(4);
		expect(
			(await install({ ...octet, "X-App-Id": "a" }, validPackage())).status,
		).toBe(201);
		expect(fake.iox.apps.get("a")?.state).toBe("DEPLOYED");
	});

	it("rejects malformed state changes", async () => {
		const headers = {
			"X-Token-Id": await ioxToken(),
			"Content-Type": "application/json",
		};
		const state = (query: string, body?: unknown) =>
			send(`${IOX}/apps/a/state${query}`, {
				method: "POST",
				headers,
				...(body ? { body: JSON.stringify(body) } : {}),
			});
		expect((await state("")).status).toBe(400);
		expect((await state("?action=launch")).status).toBe(400);
		expect((await state("?action=start", { resources: {} })).status).toBe(400);
		expect((await state("?action=activate", { cpu: 100 })).status).toBe(400);
		expect(
			(await state("?action=activate", { resources: { gpu: 1 } })).status,
		).toBe(400);
		expect(fake.violations).toHaveLength(5);
		expect(fake.iox.apps.get("a")?.state).toBe("DEPLOYED");
	});
});

describe("fake CloudShell strictness", () => {
	it("rejects logins that are not JSON with username, password and domain", async () => {
		const login = (headers: Record<string, string>, body: string) =>
			send("/api/login", { method: "PUT", headers, body });
		expect((await login({ "Content-Type": "text/plain" }, "{}")).status).toBe(
			415,
		);
		expect(
			(
				await login(
					{ "Content-Type": "application/json" },
					'{"username":"dev"}',
				)
			).status,
		).toBe(400);
		expect(fake.violations).toHaveLength(2);
	});

	it("rejects calls without the Basic token and v1-style extend bodies", async () => {
		expect((await send("/api/v2/sandboxes")).status).toBe(401);
		const headers = {
			Authorization: `Basic ${await qualiToken()}`,
			"Content-Type": "application/json",
		};
		const id = fake.quali.sandboxes[1]?.id ?? "";
		const extend = (body: unknown) =>
			send(`/api/v2/sandboxes/${id}/extend`, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
			});
		expect((await extend({ duration_minutes: 60 })).status).toBe(400);
		expect((await send("/api/v1/sandboxes", { headers })).status).toBe(404);
		expect(fake.violations).toHaveLength(3);
		const before = fake.quali.sandboxes[1]?.end_time;
		expect((await extend({ extended_time: "PT15M" })).status).toBe(200);
		expect(fake.quali.sandboxes[1]?.end_time).not.toBe(before);
	});
});
