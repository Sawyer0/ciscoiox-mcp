import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { loadConfig } from "./config/env";
import { createServer } from "./mcp/server";
import { registerLabTools } from "./mcp/tools";
import { QualiClient } from "./quali/client";

async function main() {
	// stdout carries the MCP protocol, so dotenv must not print to it.
	dotenv.config({ quiet: true });
	const config = loadConfig(process.env);
	const server = createServer();
	if (config.quali) {
		registerLabTools(server, new QualiClient(config.quali));
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("DockerIOx MCP Server running on stdio");
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
