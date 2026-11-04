import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { QualiSandboxApi } from "./adapters/quali/quali-sandbox-api";
import { loadConfig } from "./config/env";
import { createMcpServer } from "./mcp/server";
import { LabService } from "./services/lab-service";

async function main() {
	// stdout carries the MCP protocol, so dotenv must not print to it.
	dotenv.config({ quiet: true });
	const config = loadConfig(process.env);
	const server = createMcpServer({
		...(config.quali
			? {
					lab: new LabService(new QualiSandboxApi(config.quali), {
						...(config.quali.labId ? { labId: config.quali.labId } : {}),
					}),
				}
			: {}),
	});
	await server.connect(new StdioServerTransport());
	console.error("ciscoiox-mcp running on stdio");
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
