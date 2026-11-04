import { z } from "zod";

/** IOx Local Manager accepts up to 64 letters, numbers and underscores. */
export const appIdInput = z
	.string()
	.regex(/^\w{1,64}$/, "App ids are 1-64 letters, numbers or underscores")
	.describe("IOx application id, e.g. hello_iox.");

export const resourcesInput = z
	.object({
		profile: z
			.string()
			.optional()
			.describe(
				"Resource profile such as c1.small, or 'custom' with explicit values.",
			),
		cpu: z.number().int().positive().optional().describe("CPU units."),
		memory: z.number().int().positive().optional().describe("Memory in MB."),
		disk: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Persistent disk in MB."),
	})
	.describe(
		"Resources to reserve. Defaults to the package descriptor or app settings.",
	);
