import { parse } from "yaml";
import { z } from "zod";
import { PackageError } from "../domain/errors";
import type { ResourceRequest } from "../domain/iox";

const quantity = z.coerce.number().nonnegative();

/** The subset of an IOx package.yaml this server validates and uses. */
const descriptorSchema = z.object({
	"descriptor-schema-version": z
		.union([z.string(), z.number()])
		.transform(String),
	info: z.object({
		name: z.string().min(1),
		version: z.union([z.string(), z.number()]).transform(String).optional(),
		description: z.string().optional(),
	}),
	app: z.object({
		type: z.string().min(1),
		cpuarch: z.string().optional(),
		resources: z
			.object({
				profile: z.string().optional(),
				cpu: quantity.optional(),
				memory: quantity.optional(),
				disk: quantity.optional(),
			})
			.optional(),
		startup: z.object({ rootfs: z.string().optional() }).loose().optional(),
	}),
});

export interface PackageDescriptor {
	schemaVersion: string;
	name: string;
	version?: string;
	appType: string;
	cpuarch?: string;
	resources: ResourceRequest;
	/** Artifact the app boots from (docker/lxc rootfs tarball), if declared. */
	rootfs?: string;
}

/** Parses and validates package.yaml text; throws PackageError with every problem found. */
export function parseDescriptor(source: string): PackageDescriptor {
	let document: unknown;
	try {
		document = parse(source);
	} catch (error) {
		throw new PackageError(
			`package.yaml is not valid YAML: ${(error as Error).message}`,
		);
	}
	const result = descriptorSchema.safeParse(document);
	if (!result.success) {
		const problems = result.error.issues
			.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
			.join("; ");
		throw new PackageError(`package.yaml is invalid: ${problems}`);
	}
	const { info, app } = result.data;
	const { profile, cpu, memory, disk } = app.resources ?? {};
	return {
		schemaVersion: result.data["descriptor-schema-version"],
		name: info.name,
		appType: app.type,
		...(info.version ? { version: info.version } : {}),
		...(app.cpuarch ? { cpuarch: app.cpuarch } : {}),
		resources: {
			...(profile !== undefined ? { profile } : {}),
			...(cpu !== undefined ? { cpu } : {}),
			...(memory !== undefined ? { memory } : {}),
			...(disk !== undefined ? { disk } : {}),
		},
		...(app.startup?.rootfs ? { rootfs: app.startup.rootfs } : {}),
	};
}
