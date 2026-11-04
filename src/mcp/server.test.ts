import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "./server";

describe("MCP Server", () => {
	it("should create an MCP server instance", () => {
		const server = createServer();
		expect(server).toBeDefined();
		// Check if it has the expected methods (basic duck typing or instance check if exported)
		expect(typeof server.connect).toBe("function");
	});
});
