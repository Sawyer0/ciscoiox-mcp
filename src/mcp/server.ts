import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export const createServer = () => {
	// Create an MCP server on top of Stdio
	const server = new McpServer({
		name: "dockeriox-sandbox-mcp",
		version: "1.0.0",
	});

	return server;
};

export const startServer = async () => {
	const server = createServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("DockerIOx MCP Server running on stdio");
};
