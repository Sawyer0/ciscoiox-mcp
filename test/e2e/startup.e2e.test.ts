import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUN, ENTRY } from "./harness";

const run = (env: Record<string, string>) =>
	spawnSync(BUN, [ENTRY], {
		cwd: mkdtempSync(join(tmpdir(), "ciscoiox-start-")),
		env: { PATH: process.env.PATH ?? "", ...env },
		encoding: "utf8",
		timeout: 15_000,
	});

describe("server startup", () => {
	it("exits non-zero with a readable message when nothing is configured", () => {
		const result = run({});
		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Nothing to serve: set QUALI_PORTAL_HOST");
	});

	it("names the missing variables of a half-configured integration", () => {
		const result = run({ IOX_HOST: "10.10.20.50" });
		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain(
			"IOX_USER is required; IOX_PASS is required",
		);
	});
});
