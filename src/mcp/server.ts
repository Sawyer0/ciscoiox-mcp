import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppInsightsService } from "../services/app-insights";
import type { AppLifecycleService } from "../services/app-lifecycle";
import type { LabService } from "../services/lab-service";
import { registerAppTools } from "./app-tools";
import { registerInsightTools } from "./insight-tools";
import { registerLabTools } from "./lab-tools";

export interface ServerServices {
	lab?: LabService;
	apps?: AppLifecycleService;
	insights?: AppInsightsService;
}

export const SERVER_NAME = "ciscoiox-mcp";
export const SERVER_VERSION = "0.1.0";

/** Builds the MCP server, registering only the tool groups whose services exist. */
export function createMcpServer(services: ServerServices): McpServer {
	const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
	if (services.lab) registerLabTools(server, services.lab);
	if (services.apps) registerAppTools(server, services.apps);
	if (services.insights) registerInsightTools(server, services.insights);
	return server;
}
