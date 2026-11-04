import { PackageError } from "../domain/errors";
import { type PackageDescriptor, parseDescriptor } from "./package-descriptor";
import { createTarArchive } from "./tar-archive";

/** Port to the local file system, so packaging is testable without disk access. */
export interface PackageFiles {
	kind(path: string): Promise<"file" | "directory" | "missing">;
	readFile(path: string): Promise<Uint8Array>;
	/** Every regular file under dir, as forward-slash paths relative to dir. */
	listFiles(dir: string): Promise<string[]>;
	join(dir: string, relative: string): string;
}

export interface AppPackage {
	bytes: Uint8Array;
	/** Present when the package was built from a directory. */
	descriptor?: PackageDescriptor;
	files: string[];
}

const ARCHIVE_SUFFIXES = [".tar", ".tar.gz", ".tgz"];
const SKIPPED = [/^\.git\//, /(^|\/)\.DS_Store$/, /^package\.tar$/];
const USTAR_MAGIC = "ustar";

const isGzip = (bytes: Uint8Array) => bytes[0] === 0x1f && bytes[1] === 0x8b;
const isTar = (bytes: Uint8Array) =>
	new TextDecoder().decode(bytes.subarray(257, 262)) === USTAR_MAGIC;

/**
 * Turns a path into an uploadable IOx package: an existing .tar/.tar.gz is
 * checked and passed through; a directory with package.yaml is validated and
 * archived as package.tar.
 */
export class AppPackager {
	constructor(private readonly files: PackageFiles) {}

	async load(path: string): Promise<AppPackage> {
		const kind = await this.files.kind(path);
		if (kind === "missing")
			throw new PackageError(`Package path not found: ${path}`);
		return kind === "file"
			? this.loadArchive(path)
			: this.buildFromDirectory(path);
	}

	private async loadArchive(path: string): Promise<AppPackage> {
		if (!ARCHIVE_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
			throw new PackageError(
				`Expected an IOx package (.tar, .tar.gz or .tgz) or a directory with package.yaml: ${path}`,
			);
		}
		const bytes = await this.files.readFile(path);
		if (!isGzip(bytes) && !isTar(bytes)) {
			throw new PackageError(`${path} is not a tar or gzip archive.`);
		}
		return { bytes, files: [path] };
	}

	private async buildFromDirectory(dir: string): Promise<AppPackage> {
		const files = (await this.files.listFiles(dir))
			.filter((file) => !SKIPPED.some((pattern) => pattern.test(file)))
			.sort((a, b) =>
				a === "package.yaml"
					? -1
					: b === "package.yaml"
						? 1
						: a.localeCompare(b),
			);
		if (!files.includes("package.yaml")) {
			throw new PackageError(
				`No package.yaml in ${dir}; IOx packages need a descriptor.`,
			);
		}
		const read = (file: string) =>
			this.files.readFile(this.files.join(dir, file));
		const descriptor = parseDescriptor(
			new TextDecoder().decode(await read("package.yaml")),
		);
		if (descriptor.rootfs && !files.includes(descriptor.rootfs)) {
			throw new PackageError(
				`package.yaml declares rootfs "${descriptor.rootfs}" but the file is not in ${dir}.`,
			);
		}
		const entries = await Promise.all(
			files.map(async (path) => ({ path, data: await read(path) })),
		);
		return { bytes: createTarArchive(entries), descriptor, files };
	}
}
