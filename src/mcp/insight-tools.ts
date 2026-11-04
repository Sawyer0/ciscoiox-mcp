import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppInsightsService } from "../services/app-insights";
import { appIdInput } from "./tool-inputs";
import { jsonResult, runTool, textResult } from "./tool-response";

const readOnly = { readOnlyHint: true };

export function registerInsightTools(
	server: McpServer,
	insights: AppInsightsService,
): void {
	server.registerTool(
		"get_platform_status",
		{
			title: "Get IOx platform status",
			description:
				"Shows the IOx host's platform info, total and free CPU/memory/disk, and its resource profiles.",
			annotations: readOnly,
		},
		() =>
			runTool("reading platform status", async () =>
				jsonResult(await insights.platformStatus()),
			),
	);

	server.registerTool(
		"list_app_logs",
		{
			title: "List IOx app logs",
			description: "Lists an app's log files with sizes and timestamps.",
			inputSchema: { appId: appIdInput },
			annotations: readOnly,
		},
		({ appId }) =>
			runTool(`listing logs for ${appId}`, async () =>
				jsonResult(await insights.listLogs(appId)),
			),
	);

	server.registerTool(
		"tail_app_log",
		{
			title: "Tail IOx app log",
			description:
				"Returns the last lines of an app log file, e.g. stdout.log or watchDog.log, for troubleshooting.",
			inputSchema: {
				appId: appIdInput,
				filename: z
					.string()
					.min(1)
					.describe("Log file name from list_app_logs."),
				lines: z
					.number()
					.int()
					.min(1)
					.max(2000)
					.default(100)
					.describe("Lines to return."),
			},
			annotations: readOnly,
		},
		({ appId, filename, lines }) =>
			runTool(`reading ${filename} for ${appId}`, async () => {
				const tail = await insights.tailLog(appId, filename, lines);
				return textResult(
					`${tail.appId}/${tail.filename}, last ${tail.lineCount} line(s):\n${tail.content}`,
				);
			}),
	);

	server.registerTool(
		"get_app_metrics",
		{
			title: "Get IOx app metrics",
			description:
				"Shows an app's state and current resource usage: memory (KB), CPU (%), network (bytes) and disk (MB).",
			inputSchema: { appId: appIdInput },
			annotations: readOnly,
		},
		({ appId }) =>
			runTool(`reading metrics for ${appId}`, async () =>
				jsonResult(await insights.appHealth(appId)),
			),
	);
}
