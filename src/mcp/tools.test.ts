import { describe, expect, it } from "vitest";
import type { QualiClient } from "../quali/client";
import { createServer } from "./server";
import { registerLabTools } from "./tools";

describe("MCP Tools Registration", () => {
	it("should register lab tools", () => {
		const server = createServer();
		const client = {} as QualiClient;
		expect(() => registerLabTools(server, client)).not.toThrow();
	});
});
