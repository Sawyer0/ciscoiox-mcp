import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, type ServerServices } from "../../src/mcp/server";

export type ToolCall = Awaited<ReturnType<Client["callTool"]>>;

/** Connects an MCP client to a server built from the given services, in memory. */
export async function connectClient(services: ServerServices): Promise<Client> {
	const server = createMcpServer(services);
	const client = new Client({ name: "test", version: "1.0.0" });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
	return client;
}

export const textOf = (result: ToolCall): string =>
	(result.content as Array<{ text: string }>)[0]?.text ?? "";

export const jsonOf = (result: ToolCall): unknown => JSON.parse(textOf(result));
