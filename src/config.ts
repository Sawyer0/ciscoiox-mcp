import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  QUALI_TOKEN: z.string().min(1, "QUALI_TOKEN is required"),
  IOX_HOST: z.string().min(1, "IOX_HOST is required"),
  LAB_ID: z.string().min(1, "LAB_ID is required"),
  IOX_USER: z.string().min(1, "IOX_USER is required"),
  IOX_PASS: z.string().min(1, "IOX_PASS is required"),
  IOX_PORT: z.coerce.number().default(8443),
});

export const config = envSchema.parse(process.env);
