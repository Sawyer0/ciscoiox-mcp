import { NodePackageFiles } from "./adapters/fs/node-package-files";
import { IoxCafApi } from "./adapters/iox/iox-caf-api";
import { QualiSandboxApi } from "./adapters/quali/quali-sandbox-api";
import type { AppConfig } from "./config/env";
import type { ServerServices } from "./mcp/server";
import { AppPackager } from "./packaging/app-packager";
import { AppInsightsService } from "./services/app-insights";
import { AppLifecycleService } from "./services/app-lifecycle";
import { LabService } from "./services/lab-service";

/** Wires real adapters into services for each configured integration. */
export function buildServices(config: AppConfig): ServerServices {
	const services: ServerServices = {};
	if (config.quali) {
		const { labId } = config.quali;
		services.lab = new LabService(
			new QualiSandboxApi(config.quali),
			labId ? { labId } : {},
		);
	}
	if (config.iox) {
		const iox = new IoxCafApi(config.iox);
		services.apps = new AppLifecycleService(
			iox,
			new AppPackager(new NodePackageFiles()),
		);
		services.insights = new AppInsightsService(iox);
	}
	return services;
}

export const enabledGroups = (services: ServerServices): string[] =>
	[
		services.lab && "lab",
		services.apps && "apps",
		services.insights && "insights",
	].filter((group): group is string => typeof group === "string");
