import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LabService } from "../services/lab-service";
import { registerLabTools } from "./lab-tools";

export interface ServerServices {
	lab?: LabService;
}

export const SERVER_NAME = "ciscoiox-mcp";
export const SERVER_VERSION = "0.1.0";

/** Builds the MCP server, registering only the tool groups whose services exist. */
export function createMcpServer(services: ServerServices): McpServer {
	const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
	if (services.lab) registerLabTools(server, services.lab);
	return server;
}
