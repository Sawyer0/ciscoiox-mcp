import { InvalidStateError } from "./errors";
import type { IoxApp, LifecycleAction } from "./iox";

/** States each action may start from, per the IOx Local Manager reference guide. */
export const ALLOWED_FROM: Record<LifecycleAction, readonly string[]> = {
	activate: ["DEPLOYED"],
	start: ["ACTIVATED", "STOPPED"],
	stop: ["RUNNING"],
	deactivate: ["ACTIVATED", "STOPPED"],
};

/** States in which an app holds reserved CPU and memory. */
export const RESERVING_STATES: readonly string[] = [
	"ACTIVATED",
	"RUNNING",
	"STOPPED",
];

export function assertTransition(app: IoxApp, action: LifecycleAction): void {
	const allowed = ALLOWED_FROM[action];
	if (!allowed.includes(app.state)) {
		throw new InvalidStateError(
			`Cannot ${action} "${app.id}": it is ${app.state}; ${action} needs ${allowed.join(" or ")}.`,
		);
	}
}
