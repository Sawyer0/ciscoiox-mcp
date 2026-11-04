import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppLifecycleService } from "../services/app-lifecycle";
import { appIdInput, resourcesInput } from "./tool-inputs";
import { jsonResult, runTool } from "./tool-response";

const byId = { appId: appIdInput };

export function registerAppTools(
	server: McpServer,
	apps: AppLifecycleService,
): void {
	server.registerTool(
		"list_apps",
		{
			title: "List IOx apps",
			description:
				"Lists the applications installed on the IOx host with their state.",
			annotations: { readOnlyHint: true },
		},
		() =>
			runTool("listing apps", async () => jsonResult(await apps.listApps())),
	);

	server.registerTool(
		"get_app",
		{
			title: "Get IOx app",
			description:
				"Shows one application's state, version and reserved resources.",
			inputSchema: byId,
			annotations: { readOnlyHint: true },
		},
		({ appId }) =>
			runTool(`reading app ${appId}`, async () =>
				jsonResult(await apps.getApp(appId)),
			),
	);

	server.registerTool(
		"deploy_app",
		{
			title: "Deploy IOx app",
			description:
				"Uploads an IOx package and optionally activates and starts it. packagePath is a path on the machine running this server: either a .tar/.tar.gz package or a directory containing package.yaml, which is validated and packaged first. Free CPU, memory and disk are checked before anything is uploaded.",
			inputSchema: {
				appId: appIdInput,
				packagePath: z
					.string()
					.min(1)
					.describe("Package file or app directory."),
				activate: z
					.boolean()
					.default(false)
					.describe("Activate after install."),
				start: z
					.boolean()
					.default(false)
					.describe("Activate and start after install."),
				resources: resourcesInput.optional(),
			},
		},
		(input) =>
			runTool(`deploying ${input.appId}`, async () =>
				jsonResult(
					await apps.deploy({
						appId: input.appId,
						packagePath: input.packagePath,
						activate: input.activate,
						start: input.start,
						...(input.resources ? { resources: input.resources } : {}),
					}),
				),
			),
	);

	server.registerTool(
		"activate_app",
		{
			title: "Activate IOx app",
			description:
				"Reserves CPU, memory and disk for a DEPLOYED app after checking the device has room.",
			inputSchema: { appId: appIdInput, resources: resourcesInput.optional() },
		},
		({ appId, resources }) =>
			runTool(`activating ${appId}`, async () =>
				jsonResult(await apps.activate(appId, resources)),
			),
	);

	const simple = [
		[
			"start_app",
			"Start IOx app",
			"Starts an ACTIVATED or STOPPED app.",
			"starting",
			apps.start,
		],
		[
			"stop_app",
			"Stop IOx app",
			"Stops a RUNNING app; its resources stay reserved.",
			"stopping",
			apps.stop,
		],
		[
			"deactivate_app",
			"Deactivate IOx app",
			"Releases the resources of an ACTIVATED or STOPPED app.",
			"deactivating",
			apps.deactivate,
		],
	] as const;
	for (const [name, title, description, verb, action] of simple) {
		server.registerTool(
			name,
			{ title, description, inputSchema: byId },
			({ appId }) =>
				runTool(`${verb} ${appId}`, async () =>
					jsonResult(await action.call(apps, appId)),
				),
		);
	}

	server.registerTool(
		"remove_app",
		{
			title: "Remove IOx app",
			description:
				"Uninstalls an app. A DEPLOYED app is removed directly; with force, a running or activated app is stopped and deactivated first.",
			inputSchema: {
				appId: appIdInput,
				force: z
					.boolean()
					.default(false)
					.describe("Stop and deactivate first if needed."),
			},
			annotations: { destructiveHint: true },
		},
		({ appId, force }) =>
			runTool(`removing ${appId}`, async () =>
				jsonResult(await apps.remove(appId, force)),
			),
	);
}
