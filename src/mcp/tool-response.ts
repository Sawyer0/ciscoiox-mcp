import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DomainError, UpstreamError } from "../domain/errors";

export const jsonResult = (value: unknown): CallToolResult => ({
	content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

export const textResult = (text: string): CallToolResult => ({
	content: [{ type: "text", text }],
});

const describe = (error: unknown): string => {
	if (error instanceof DomainError || error instanceof UpstreamError) {
		return error.message;
	}
	if (error instanceof Error) return `Unexpected error: ${error.message}`;
	return "Unexpected error";
};

export const errorResult = (
	error: unknown,
	action: string,
): CallToolResult => ({
	content: [{ type: "text", text: `Error ${action}: ${describe(error)}` }],
	isError: true,
});

/** Runs a tool body and turns any thrown error into an MCP error result. */
export async function runTool(
	action: string,
	body: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
	try {
		return await body();
	} catch (error) {
		return errorResult(error, action);
	}
}
