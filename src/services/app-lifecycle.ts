import {
	InvalidStateError,
	NotFoundError,
	QuotaExceededError,
} from "../domain/errors";
import type {
	IoxApp,
	IoxGateway,
	LifecycleAction,
	ResourceRequest,
} from "../domain/iox";
import { assertTransition, RESERVING_STATES } from "../domain/lifecycle";
import type { AppPackager } from "../packaging/app-packager";
import { findShortfalls, resolveRequirement } from "./quota";

export interface DeployRequest {
	appId: string;
	packagePath: string;
	activate?: boolean;
	start?: boolean;
	resources?: ResourceRequest;
}

export interface DeployResult {
	app: IoxApp;
	steps: string[];
	packagedFiles: string[];
}

export interface RemoveResult {
	removed: string;
	steps: string[];
}

const isEmpty = (request: ResourceRequest) => Object.keys(request).length === 0;

/** Install, lifecycle and removal of IOx apps, with state and quota checks up front. */
export class AppLifecycleService {
	constructor(
		private readonly iox: IoxGateway,
		private readonly packager: AppPackager,
	) {}

	listApps(): Promise<IoxApp[]> {
		return this.iox.listApps();
	}

	getApp(appId: string): Promise<IoxApp> {
		return this.iox.getApp(appId);
	}

	async deploy(request: DeployRequest): Promise<DeployResult> {
		if (await this.exists(request.appId)) {
			throw new InvalidStateError(
				`"${request.appId}" is already installed. Remove it first or pick another app id.`,
			);
		}
		const pkg = await this.packager.load(request.packagePath);
		const resources = request.resources ?? pkg.descriptor?.resources ?? {};
		const activate = request.activate === true || request.start === true;
		if (activate) await this.ensureCapacity(resources);

		const steps = [
			`installed ${pkg.files.length} file(s) as "${request.appId}"`,
		];
		await this.iox.installApp(request.appId, pkg.bytes);
		if (activate) {
			await this.iox.changeState(
				request.appId,
				"activate",
				isEmpty(resources) ? undefined : resources,
			);
			steps.push("activated");
		}
		if (request.start) {
			await this.iox.changeState(request.appId, "start");
			steps.push("started");
		}
		return {
			app: await this.iox.getApp(request.appId),
			steps,
			packagedFiles: pkg.files,
		};
	}

	async activate(appId: string, resources?: ResourceRequest): Promise<IoxApp> {
		const app = await this.iox.getApp(appId);
		assertTransition(app, "activate");
		await this.ensureCapacity(resources ?? app.resources ?? {});
		await this.iox.changeState(appId, "activate", resources);
		return this.iox.getApp(appId);
	}

	start(appId: string): Promise<IoxApp> {
		return this.transition(appId, "start");
	}

	stop(appId: string): Promise<IoxApp> {
		return this.transition(appId, "stop");
	}

	deactivate(appId: string): Promise<IoxApp> {
		return this.transition(appId, "deactivate");
	}

	/** Uninstalls an app; with force, stops and deactivates it first. */
	async remove(appId: string, force = false): Promise<RemoveResult> {
		const app = await this.iox.getApp(appId);
		const steps: string[] = [];
		if (RESERVING_STATES.includes(app.state)) {
			if (!force) {
				throw new InvalidStateError(
					`"${appId}" is ${app.state}. Stop and deactivate it first, or call remove_app with force: true.`,
				);
			}
			if (app.state === "RUNNING") {
				await this.iox.changeState(appId, "stop");
				steps.push("stopped");
			}
			await this.iox.changeState(appId, "deactivate");
			steps.push("deactivated");
		}
		await this.iox.deleteApp(appId);
		steps.push("uninstalled");
		return { removed: appId, steps };
	}

	private async transition(
		appId: string,
		action: LifecycleAction,
	): Promise<IoxApp> {
		assertTransition(await this.iox.getApp(appId), action);
		await this.iox.changeState(appId, action);
		return this.iox.getApp(appId);
	}

	private async ensureCapacity(request: ResourceRequest): Promise<void> {
		const [profiles, allocations] = await Promise.all([
			this.iox.resourceProfiles(),
			this.iox.resourceAllocations(),
		]);
		const shortfalls = findShortfalls(
			resolveRequirement(request, profiles),
			allocations,
		);
		if (shortfalls.length > 0) {
			throw new QuotaExceededError(
				`Not enough free resources on the device (${shortfalls.join("; ")}). Stop or deactivate another app, or request a smaller profile.`,
			);
		}
	}

	private async exists(appId: string): Promise<boolean> {
		try {
			await this.iox.getApp(appId);
			return true;
		} catch (error) {
			if (error instanceof NotFoundError) return false;
			throw error;
		}
	}
}
