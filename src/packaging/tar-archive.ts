import { PackageError } from "../domain/errors";

export interface ArchiveEntry {
	/** Forward-slash path inside the archive, e.g. "package.yaml" or "app/main.py". */
	path: string;
	data: Uint8Array;
	/** POSIX permission bits; defaults to 0644. */
	mode?: number;
}

const BLOCK = 512;
const encoder = new TextEncoder();

function writeString(
	block: Uint8Array,
	offset: number,
	length: number,
	value: string,
) {
	const bytes = encoder.encode(value);
	if (bytes.length > length)
		throw new PackageError(`Tar field too long: ${value}`);
	block.set(bytes, offset);
}

function writeOctal(
	block: Uint8Array,
	offset: number,
	length: number,
	value: number,
) {
	writeString(
		block,
		offset,
		length,
		`${value.toString(8).padStart(length - 1, "0")}\0`,
	);
}

/** Splits a path into ustar name (<=100 bytes) and prefix (<=155 bytes). */
function splitPath(path: string): { name: string; prefix: string } {
	if (encoder.encode(path).length <= 100) return { name: path, prefix: "" };
	for (
		let cut = path.lastIndexOf("/");
		cut > 0;
		cut = path.lastIndexOf("/", cut - 1)
	) {
		const prefix = path.slice(0, cut);
		const name = path.slice(cut + 1);
		if (
			encoder.encode(name).length <= 100 &&
			encoder.encode(prefix).length <= 155
		) {
			return { name, prefix };
		}
	}
	throw new PackageError(`Path too long for a tar archive: ${path}`);
}

function header(entry: ArchiveEntry, mtime: number): Uint8Array {
	const block = new Uint8Array(BLOCK);
	const { name, prefix } = splitPath(entry.path);
	writeString(block, 0, 100, name);
	writeOctal(block, 100, 8, entry.mode ?? 0o644);
	writeOctal(block, 108, 8, 0);
	writeOctal(block, 116, 8, 0);
	writeOctal(block, 124, 12, entry.data.length);
	writeOctal(block, 136, 12, mtime);
	block.fill(0x20, 148, 156); // checksum is computed with this field as spaces
	writeString(block, 156, 1, "0");
	writeString(block, 257, 6, "ustar\0");
	writeString(block, 263, 2, "00");
	writeString(block, 345, 155, prefix);
	const checksum = block.reduce((sum, byte) => sum + byte, 0);
	writeString(block, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
	return block;
}

/**
 * Writes an uncompressed POSIX ustar archive, the format IOx expects for
 * package.tar. Entries keep their order; mtime defaults to now.
 */
export function createTarArchive(
	entries: ArchiveEntry[],
	mtime = Math.floor(Date.now() / 1000),
): Uint8Array {
	const seen = new Set<string>();
	const size = entries.reduce(
		(total, e) => total + BLOCK + Math.ceil(e.data.length / BLOCK) * BLOCK,
		BLOCK * 2,
	);
	const archive = new Uint8Array(size);
	let offset = 0;
	for (const entry of entries) {
		if (
			entry.path === "" ||
			entry.path.startsWith("/") ||
			entry.path.split("/").includes("..")
		) {
			throw new PackageError(`Unsafe path in package: ${entry.path}`);
		}
		if (seen.has(entry.path))
			throw new PackageError(`Duplicate path: ${entry.path}`);
		seen.add(entry.path);
		archive.set(header(entry, mtime), offset);
		archive.set(entry.data, offset + BLOCK);
		offset += BLOCK + Math.ceil(entry.data.length / BLOCK) * BLOCK;
	}
	return archive; // trailing two zero blocks are already zero-filled
}
