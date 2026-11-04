import { describe, expect, it } from "vitest";
import { parseAppList, parseMetrics, parseToken } from "./iox-payloads";

describe("IOx payload parsing", () => {
	it("accepts both token shapes", () => {
		expect(parseToken({ token: { id: "a" } })).toBe("a");
		expect(parseToken({ id: "b" })).toBe("b");
		expect(() => parseToken({})).toThrow();
	});

	it("accepts app lists as arrays, wrappers or id-keyed maps", () => {
		const app = { name: "py", state: "RUNNING" };
		expect(parseAppList([{ id: "py", ...app }])[0]?.id).toBe("py");
		expect(parseAppList({ apps: [{ id: "py", ...app }] })[0]?.id).toBe("py");
		expect(parseAppList({ py: app })).toEqual([
			{ id: "py", name: "py", state: "RUNNING" },
		]);
	});

	it("reads bare-number metrics at the top level", () => {
		expect(parseMetrics("py", { memory: 10, cpu: "0.5" })).toEqual({
			appId: "py",
			memoryKb: 10,
			cpuPercent: 0.5,
		});
	});
});
