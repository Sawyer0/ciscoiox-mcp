import { describe, expect, it } from "vitest";
import { InMemoryIox } from "../../test/fakes/in-memory-iox";
import { NotFoundError } from "../domain/errors";
import { AppInsightsService } from "./app-insights";

const iox = new InMemoryIox().seed({ id: "py", name: "py", state: "RUNNING" });
const insights = new AppInsightsService(iox);

describe("AppInsightsService", () => {
	it("tails the last N lines of a log", async () => {
		await expect(insights.tailLog("py", "stdout.log", 2)).resolves.toEqual({
			appId: "py",
			filename: "stdout.log",
			lineCount: 2,
			content: "two\nthree",
		});
	});

	it("lists available logs when the requested one is missing", async () => {
		const error = await insights
			.tailLog("py", "nope.log", 5)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NotFoundError);
		expect(String(error)).toMatch(/Available: stdout.log/);
	});

	it("combines app state with metrics", async () => {
		await expect(insights.appHealth("py")).resolves.toMatchObject({
			appId: "py",
			state: "RUNNING",
			memoryKb: 6688,
		});
	});

	it("collects platform info, allocations and profiles", async () => {
		const status = await insights.platformStatus();
		expect(status.info).toEqual({ product_id: "IR1101-K9" });
		expect(status.profiles).toHaveLength(2);
		expect(status.allocations.cpu.available).toBe(400);
	});
});
