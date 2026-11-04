import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readTarEntries } from "../../test/fake-cisco/tar-entries";
import { MemoryPackageFiles } from "../../test/fakes/memory-package-files";
import { NodePackageFiles } from "../adapters/fs/node-package-files";
import { PackageError } from "../domain/errors";
import { AppPackager } from "./app-packager";

const descriptor = `descriptor-schema-version: "2.2"
info: { name: demo }
app: { type: docker, startup: { rootfs: rootfs.tar } }
`;

const pathsIn = (bytes: Uint8Array) =>
	readTarEntries(Buffer.from(bytes)).map((e) => e.path);

describe("AppPackager", () => {
	it("builds package.tar from a directory with package.yaml first", async () => {
		const files = new MemoryPackageFiles({
			"app/rootfs.tar": "rootfs",
			"app/package.yaml": descriptor,
			"app/.git/HEAD": "ref",
			"app/package.tar": "stale",
		});
		const pkg = await new AppPackager(files).load("app");
		expect(pathsIn(pkg.bytes)).toEqual(["package.yaml", "rootfs.tar"]);
		expect(pkg.descriptor?.name).toBe("demo");
	});

	it("packages the real fixture directory from disk", async () => {
		const dir = resolve(import.meta.dirname, "../../test/fixtures/hello-app");
		const pkg = await new AppPackager(new NodePackageFiles()).load(dir);
		expect(pathsIn(pkg.bytes)).toEqual(["package.yaml", "app/main.py"]);
		expect(pkg.descriptor?.resources).toEqual({
			profile: "c1.small",
			disk: 10,
		});
	});

	it("passes a prebuilt archive through after checking it is one", async () => {
		const tar = new Uint8Array(1024);
		tar.set(new TextEncoder().encode("ustar"), 257);
		const files = new MemoryPackageFiles({
			"pkg.tar": tar,
			"bad.tar": "hello",
			"x.zip": "z",
		});
		const packager = new AppPackager(files);
		await expect(packager.load("pkg.tar")).resolves.toMatchObject({
			bytes: tar,
		});
		await expect(packager.load("bad.tar")).rejects.toThrow(/not a tar or gzip/);
		await expect(packager.load("x.zip")).rejects.toThrow(
			/Expected an IOx package/,
		);
	});

	it("explains what is missing", async () => {
		const files = new MemoryPackageFiles({
			"nodesc/main.py": "x",
			"norootfs/package.yaml": descriptor,
		});
		const packager = new AppPackager(files);
		await expect(packager.load("nowhere")).rejects.toThrow(/not found/);
		await expect(packager.load("nodesc")).rejects.toThrow(/No package.yaml/);
		await expect(packager.load("norootfs")).rejects.toThrow(PackageError);
	});
});
