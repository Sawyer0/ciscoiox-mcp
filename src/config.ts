import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
	// Quali / Sandbox Config
	QUALI_PORTAL_HOST: z.string().min(1, "QUALI_PORTAL_HOST is required"),
	QUALI_PORTAL_PORT: z.coerce.number().default(8032),
	QUALI_DOMAIN: z.string().default("Global"),
	QUALI_USER: z.string().min(1, "QUALI_USER is required"),
	QUALI_PASS: z.string().min(1, "QUALI_PASS is required"),

	// IOx Config
	IOX_HOST: z.string().min(1, "IOX_HOST is required"),
	// ... other IOx fields
	LAB_ID: z.string().optional(), // Might be fetched dynamically now? But keeping it for safety if needed
	IOX_USER: z.string().min(1, "IOX_USER is required"),
	IOX_PASS: z.string().min(1, "IOX_PASS is required"),
	IOX_PORT: z.coerce.number().default(8443),
});
export const config = envSchema.parse(process.env);
