import { z } from "zod";
import type {
	AppMetrics,
	IoxApp,
	LogFile,
	ResourceAllocations,
	ResourceProfile,
	ResourceRequest,
} from "../../domain/iox";

/** CAF sometimes sends numbers as strings ("cpu": "200"). */
const quantity = z.coerce.number().nonnegative();

const resourcesSchema = z
	.object({
		profile: z.string().optional(),
		cpu: quantity.optional(),
		memory: quantity.optional(),
		disk: quantity.optional(),
	})
	.loose();

const appSchema = z
	.object({
		id: z.string().optional(),
		name: z.string().optional(),
		state: z.string(),
		version: z.string().optional(),
		description: z.string().optional(),
		resources: resourcesSchema.optional(),
	})
	.loose();

const toResources = (raw: z.infer<typeof resourcesSchema>): ResourceRequest => {
	const { profile, cpu, memory, disk } = raw;
	return {
		...(profile !== undefined ? { profile } : {}),
		...(cpu !== undefined ? { cpu } : {}),
		...(memory !== undefined ? { memory } : {}),
		...(disk !== undefined ? { disk } : {}),
	};
};

export function parseApp(raw: unknown, fallbackId?: string): IoxApp {
	const app = appSchema.parse(raw);
	const id = app.id ?? fallbackId;
	if (!id) throw new Error("IOx app payload has no id");
	return {
		id,
		name: app.name ?? id,
		state: app.state,
		...(app.version ? { version: app.version } : {}),
		...(app.description ? { description: app.description } : {}),
		...(app.resources ? { resources: toResources(app.resources) } : {}),
	};
}

/** Accepts a list, a { apps: [...] } wrapper, or an object keyed by app id. */
export function parseAppList(raw: unknown): IoxApp[] {
	if (Array.isArray(raw)) return raw.map((item) => parseApp(item));
	const record = z.record(z.string(), z.unknown()).parse(raw);
	if (Array.isArray(record.apps)) return parseAppList(record.apps);
	return Object.entries(record).map(([id, item]) => parseApp(item, id));
}

export function parseToken(raw: unknown): string {
	const token = z
		.union([
			z.object({ token: z.object({ id: z.string().min(1) }) }),
			z.object({ id: z.string().min(1) }),
		])
		.parse(raw);
	return "token" in token ? token.token.id : token.id;
}

const logSchema = z.object({
	filename: z.string(),
	size_bytes: quantity.default(0),
	timestamp: z.string().optional(),
	download_link: z.string(),
});

export function parseLogs(raw: unknown): LogFile[] {
	return z
		.array(logSchema)
		.parse(raw)
		.map((log) => ({
			filename: log.filename,
			sizeBytes: log.size_bytes,
			downloadLink: log.download_link,
			...(log.timestamp ? { timestamp: log.timestamp } : {}),
		}));
}

/** A reading is either a bare number or { current: number }. */
const reading = z
	.union([quantity, z.object({ current: quantity }).loose()])
	.transform((value) => (typeof value === "number" ? value : value.current));

const metricsSchema = z
	.object({
		memory: reading.optional(),
		cpu: reading.optional(),
		network: reading.optional(),
		disk: reading.optional(),
	})
	.loose();

export function parseMetrics(appId: string, raw: unknown): AppMetrics {
	const record = z.record(z.string(), z.unknown()).parse(raw);
	const metrics = metricsSchema.parse(record[appId] ?? record);
	return {
		appId,
		...(metrics.memory !== undefined ? { memoryKb: metrics.memory } : {}),
		...(metrics.cpu !== undefined ? { cpuPercent: metrics.cpu } : {}),
		...(metrics.network !== undefined ? { networkBytes: metrics.network } : {}),
		...(metrics.disk !== undefined ? { diskMb: metrics.disk } : {}),
	};
}

export function parseProfiles(raw: unknown): ResourceProfile[] {
	const profiles = z
		.record(z.string(), z.object({ cpu: quantity, memory: quantity }).loose())
		.parse(raw);
	return Object.entries(profiles).map(([name, p]) => ({
		name,
		cpu: p.cpu,
		memory: p.memory,
	}));
}

export function parseAllocations(raw: unknown): ResourceAllocations {
	const a = z
		.object({
			cpu: z.object({ total_cpu: quantity, available_cpu: quantity }).loose(),
			memory: z
				.object({ total_memory: quantity, available_memory: quantity })
				.loose(),
			disk: z
				.object({
					total_persistent_disk: quantity,
					available_persistent_disk: quantity,
				})
				.loose(),
		})
		.parse(raw);
	return {
		cpu: { total: a.cpu.total_cpu, available: a.cpu.available_cpu },
		memory: {
			total: a.memory.total_memory,
			available: a.memory.available_memory,
		},
		disk: {
			total: a.disk.total_persistent_disk,
			available: a.disk.available_persistent_disk,
		},
	};
}
