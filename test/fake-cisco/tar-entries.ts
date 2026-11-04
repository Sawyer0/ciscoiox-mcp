import { gunzipSync } from "node:zlib";

export interface TarEntry {
	path: string;
	data: Buffer;
}

const field = (block: Buffer, start: number, length: number) =>
	block
		.subarray(start, start + length)
		.toString("utf8")
		.replace(/\0.*$/s, "")
		.trim();

/** Minimal ustar reader used by the fakes to inspect uploaded packages. */
export function readTarEntries(archive: Buffer): TarEntry[] {
	const bytes =
		archive[0] === 0x1f && archive[1] === 0x8b ? gunzipSync(archive) : archive;
	const entries: TarEntry[] = [];
	let offset = 0;
	while (offset + 512 <= bytes.length) {
		const header = bytes.subarray(offset, offset + 512);
		if (header.every((b) => b === 0)) break;
		if (field(header, 257, 5) !== "ustar")
			throw new Error("not a ustar archive");
		const name = field(header, 0, 100);
		const prefix = field(header, 345, 155);
		const size = Number.parseInt(field(header, 124, 12) || "0", 8);
		const type = field(header, 156, 1) || "0";
		const dataStart = offset + 512;
		if (type === "0") {
			entries.push({
				path: prefix ? `${prefix}/${name}` : name,
				data: Buffer.from(bytes.subarray(dataStart, dataStart + size)),
			});
		}
		offset = dataStart + Math.ceil(size / 512) * 512;
	}
	return entries;
}
