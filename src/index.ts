import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, startServer } from "./mcp/server";
import { registerLabTools } from "./mcp/tools";

async function main() {
	const server = createServer();
	registerLabTools(server);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("DockerIOx MCP Server running on stdio");
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
