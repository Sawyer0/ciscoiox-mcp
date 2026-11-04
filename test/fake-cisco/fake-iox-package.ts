import { parse } from "yaml";
import { readTarEntries } from "./tar-entries";

export interface InstalledPackage {
	files: string[];
	name: string;
	version: string;
	appType: string;
	resources: { profile: string; cpu?: number; memory?: number; disk: number };
}

type Descriptor = {
	info?: { name?: unknown; version?: unknown };
	app?: {
		type?: unknown;
		resources?: {
			profile?: unknown;
			cpu?: unknown;
			memory?: unknown;
			disk?: unknown;
		};
	};
};

/**
 * Opens an uploaded package the way CAF does: it must be a tar archive whose
 * package.yaml declares info.name and app.type. Returns a reason string on failure.
 */
export function openPackage(body: Buffer): InstalledPackage | string {
	let entries: ReturnType<typeof readTarEntries>;
	try {
		entries = readTarEntries(body);
	} catch (error) {
		return `package is not a valid tar archive (${(error as Error).message})`;
	}
	const yamlEntry = entries.find((entry) => entry.path === "package.yaml");
	if (!yamlEntry) return "package.yaml missing from package root";
	let descriptor: Descriptor;
	try {
		descriptor = (parse(yamlEntry.data.toString("utf8")) ?? {}) as Descriptor;
	} catch {
		return "package.yaml is not valid YAML";
	}
	const name = descriptor.info?.name;
	const appType = descriptor.app?.type;
	if (typeof name !== "string" || typeof appType !== "string") {
		return "package.yaml must declare info.name and app.type";
	}
	const r = descriptor.app?.resources ?? {};
	return {
		files: entries.map((entry) => entry.path),
		name,
		version: String(descriptor.info?.version ?? "1.0"),
		appType,
		resources: {
			profile: typeof r.profile === "string" ? r.profile : "default",
			...(r.cpu !== undefined ? { cpu: Number(r.cpu) } : {}),
			...(r.memory !== undefined ? { memory: Number(r.memory) } : {}),
			disk: Number(r.disk ?? 0),
		},
	};
}
