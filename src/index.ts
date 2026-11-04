import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { buildServices, enabledGroups } from "./composition";
import { loadConfig } from "./config/env";
import { createMcpServer } from "./mcp/server";

async function main(): Promise<void> {
	// stdout carries the MCP protocol, so dotenv must not print to it.
	dotenv.config({ quiet: true });
	const services = buildServices(loadConfig(process.env));
	const server = createMcpServer(services);
	await server.connect(new StdioServerTransport());
	console.error(
		`ciscoiox-mcp running on stdio (tools: ${enabledGroups(services).join(", ")})`,
	);
}

main().catch((error: unknown) => {
	console.error(
		`ciscoiox-mcp failed to start: ${error instanceof Error ? error.message : error}`,
	);
	process.exit(1);
});
