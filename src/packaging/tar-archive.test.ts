import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readTarEntries } from "../../test/fake-cisco/tar-entries";
import { PackageError } from "../domain/errors";
import { createTarArchive } from "./tar-archive";

const text = (s: string) => new TextEncoder().encode(s);

describe("createTarArchive", () => {
	it("round-trips entries, including empty files and block-sized payloads", () => {
		const entries = [
			{
				path: "package.yaml",
				data: text("descriptor-schema-version: '2.2'\n"),
			},
			{ path: "empty.txt", data: new Uint8Array() },
			{ path: "app/blob.bin", data: new Uint8Array(512).fill(7) },
		];
		const archive = createTarArchive(entries, 0);
		expect(archive.length % 512).toBe(0);
		const read = readTarEntries(Buffer.from(archive));
		expect(read.map((e) => [e.path, e.data.length])).toEqual([
			["package.yaml", 33],
			["empty.txt", 0],
			["app/blob.bin", 512],
		]);
	});

	it("produces an archive the system tar can list and extract", () => {
		const dir = mkdtempSync(join(tmpdir(), "tar-test-"));
		const archivePath = join(dir, "package.tar");
		const longDir = `${"nested/".repeat(16)}deep`;
		writeFileSync(
			archivePath,
			createTarArchive([
				{ path: "package.yaml", data: text("name: hello\n") },
				{
					path: `${longDir}/main.py`,
					data: text("print('hi')\n"),
					mode: 0o755,
				},
			]),
		);
		const listing = execFileSync("tar", ["-tf", archivePath], {
			encoding: "utf8",
		});
		expect(listing.trim().split("\n")).toEqual([
			"package.yaml",
			`${longDir}/main.py`,
		]);
		execFileSync("tar", ["-xf", archivePath, "-C", dir]);
		expect(readFileSync(join(dir, longDir, "main.py"), "utf8")).toBe(
			"print('hi')\n",
		);
	});

	it.each([
		"/etc/passwd",
		"../escape",
		"a/../../b",
		"",
	])("rejects unsafe path %j", (path) => {
		expect(() => createTarArchive([{ path, data: new Uint8Array() }])).toThrow(
			PackageError,
		);
	});

	it("rejects duplicate paths and names that cannot fit ustar", () => {
		const entry = { path: "a.txt", data: new Uint8Array() };
		expect(() => createTarArchive([entry, entry])).toThrow(/Duplicate/);
		expect(() =>
			createTarArchive([{ path: "x".repeat(101), data: new Uint8Array() }]),
		).toThrow(/too long/);
	});
});
