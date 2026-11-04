import type { PackageFiles } from "../../src/packaging/app-packager";

/** PackageFiles over an in-memory map of path -> contents. */
export class MemoryPackageFiles implements PackageFiles {
	private readonly files = new Map<string, Uint8Array>();

	constructor(files: Record<string, string | Uint8Array>) {
		for (const [path, content] of Object.entries(files)) {
			this.files.set(
				path,
				typeof content === "string"
					? new TextEncoder().encode(content)
					: content,
			);
		}
	}

	async kind(path: string): Promise<"file" | "directory" | "missing"> {
		if (this.files.has(path)) return "file";
		return [...this.files.keys()].some((f) => f.startsWith(`${path}/`))
			? "directory"
			: "missing";
	}

	async readFile(path: string): Promise<Uint8Array> {
		const content = this.files.get(path);
		if (!content) throw new Error(`ENOENT: ${path}`);
		return content;
	}

	async listFiles(dir: string): Promise<string[]> {
		return [...this.files.keys()]
			.filter((f) => f.startsWith(`${dir}/`))
			.map((f) => f.slice(dir.length + 1));
	}

	join(dir: string, relative: string): string {
		return `${dir}/${relative}`;
	}
}
