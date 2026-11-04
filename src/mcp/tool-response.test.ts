import { describe, expect, it } from "vitest";
import { DomainError, UpstreamError } from "../domain/errors";
import { errorResult } from "./tool-response";

const text = (error: unknown) =>
	(errorResult(error, "doing x").content[0] as { text: string }).text;

describe("errorResult", () => {
	it("passes expected failures through verbatim", () => {
		expect(text(new DomainError("nope"))).toBe("Error doing x: nope");
		expect(text(new UpstreamError("HTTP 500"))).toBe("Error doing x: HTTP 500");
	});

	it("labels unexpected failures", () => {
		expect(text(new TypeError("boom"))).toBe(
			"Error doing x: Unexpected error: boom",
		);
		expect(text("weird")).toBe("Error doing x: Unexpected error");
	});
});
