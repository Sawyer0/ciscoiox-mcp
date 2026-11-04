import { describe, expect, it } from "vitest";
import { DomainError } from "../domain/errors";
import { findShortfalls, resolveRequirement } from "./quota";

const profiles = [{ name: "c1.small", cpu: 200, memory: 64 }];
const have = {
	cpu: { total: 1000, available: 300 },
	memory: { total: 512, available: 100 },
	disk: { total: 256, available: 20 },
};

describe("quota", () => {
	it("resolves a named profile and lets explicit values win", () => {
		expect(
			resolveRequirement({ profile: "c1.small", disk: 5 }, profiles),
		).toEqual({
			cpu: 200,
			memory: 64,
			disk: 5,
		});
		expect(
			resolveRequirement({ profile: "c1.small", cpu: 50 }, profiles).cpu,
		).toBe(50);
		expect(
			resolveRequirement({ profile: "custom", cpu: 10 }, profiles),
		).toEqual({
			cpu: 10,
			memory: 0,
			disk: 0,
		});
	});

	it("names the device's profiles when an unknown one is requested", () => {
		expect(() => resolveRequirement({ profile: "c9.huge" }, profiles)).toThrow(
			new DomainError(
				'Unknown resource profile "c9.huge". This device offers: c1.small.',
			),
		);
	});

	it("reports each resource that does not fit", () => {
		expect(findShortfalls({ cpu: 200, memory: 64, disk: 10 }, have)).toEqual(
			[],
		);
		expect(findShortfalls({ cpu: 600, memory: 128, disk: 30 }, have)).toEqual([
			"CPU: needs 600 units, 300 units available",
			"memory: needs 128 MB, 100 MB available",
			"disk: needs 30 MB, 20 MB available",
		]);
	});
});
