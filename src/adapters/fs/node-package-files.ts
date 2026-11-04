import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { PackageFiles } from "../../packaging/app-packager";

/** PackageFiles backed by the real file system. */
export class NodePackageFiles implements PackageFiles {
	async kind(path: string): Promise<"file" | "directory" | "missing"> {
		try {
			const info = await stat(path);
			return info.isDirectory() ? "directory" : "file";
		} catch {
			return "missing";
		}
	}

	async readFile(path: string): Promise<Uint8Array> {
		return new Uint8Array(await readFile(path));
	}

	async listFiles(dir: string): Promise<string[]> {
		const entries = await readdir(dir, {
			recursive: true,
			withFileTypes: true,
		});
		return entries
			.filter((entry) => entry.isFile())
			.map((entry) =>
				relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"),
			);
	}

	join(dir: string, relativePath: string): string {
		return join(dir, ...relativePath.split("/"));
	}
}
