import { z } from "zod";

export interface QualiConfig {
	baseUrl: string;
	username: string;
	password: string;
	domain: string;
	labId?: string;
}

export interface IoxConfig {
	baseUrl: string;
	username: string;
	password: string;
	verifyTls: boolean;
}

export interface AppConfig {
	quali?: QualiConfig;
	iox?: IoxConfig;
}

export type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
	override name = "ConfigError";
}

const required = (name: string) =>
	z.string({ error: `${name} is required` }).min(1, `${name} is required`);
const port = z.coerce.number().int().min(1).max(65535);
const flag = z.enum(["true", "false"]).transform((value) => value === "true");

const qualiSchema = z.object({
	QUALI_PORTAL_HOST: required("QUALI_PORTAL_HOST"),
	QUALI_PORTAL_PORT: port.default(8032),
	QUALI_DOMAIN: z.string().min(1).default("Global"),
	QUALI_USER: required("QUALI_USER"),
	QUALI_PASS: required("QUALI_PASS"),
	LAB_ID: z.string().min(1).optional(),
});

const ioxSchema = z.object({
	IOX_HOST: required("IOX_HOST"),
	IOX_PORT: port.default(8443),
	IOX_SCHEME: z.enum(["https", "http"]).default("https"),
	IOX_USER: required("IOX_USER"),
	IOX_PASS: required("IOX_PASS"),
	// Sandbox devices ship self-signed certificates, so verification is opt-in.
	IOX_TLS_VERIFY: flag.default(false),
});

const blankToUndefined = (env: Env): Env =>
	Object.fromEntries(
		Object.entries(env).map(([key, value]) => [
			key,
			value === "" ? undefined : value,
		]),
	);

function parseSection<T extends z.ZodType>(
	schema: T,
	env: Env,
	section: string,
): z.output<T> {
	const result = schema.safeParse(env);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) =>
				issue.message.includes(String(issue.path[0]))
					? issue.message
					: `${String(issue.path[0])}: ${issue.message}`,
			)
			.join("; ");
		throw new ConfigError(`Invalid ${section} configuration: ${issues}`);
	}
	return result.data;
}

/**
 * Builds the server configuration from environment variables.
 * Each integration is enabled by setting its host variable; at least one is required.
 */
export function loadConfig(rawEnv: Env): AppConfig {
	const env = blankToUndefined(rawEnv);
	const config: AppConfig = {};

	if (env.QUALI_PORTAL_HOST !== undefined) {
		const quali = parseSection(qualiSchema, env, "Quali");
		config.quali = {
			baseUrl: `http://${quali.QUALI_PORTAL_HOST}:${quali.QUALI_PORTAL_PORT}/api`,
			username: quali.QUALI_USER,
			password: quali.QUALI_PASS,
			domain: quali.QUALI_DOMAIN,
			...(quali.LAB_ID ? { labId: quali.LAB_ID } : {}),
		};
	}

	if (env.IOX_HOST !== undefined) {
		const iox = parseSection(ioxSchema, env, "IOx");
		config.iox = {
			baseUrl: `${iox.IOX_SCHEME}://${iox.IOX_HOST}:${iox.IOX_PORT}/iox/api/v2/hosting`,
			username: iox.IOX_USER,
			password: iox.IOX_PASS,
			verifyTls: iox.IOX_TLS_VERIFY,
		};
	}

	if (!config.quali && !config.iox) {
		throw new ConfigError(
			"Nothing to serve: set QUALI_PORTAL_HOST (lab tools) and/or IOX_HOST (IOx tools).",
		);
	}
	return config;
}
