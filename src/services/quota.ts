import { DomainError } from "../domain/errors";
import type {
	ResourceAllocations,
	ResourceProfile,
	ResourceRequest,
} from "../domain/iox";

export interface Requirement {
	cpu: number;
	memory: number;
	disk: number;
}

/** Turns a request into concrete numbers, resolving a named profile on this device. */
export function resolveRequirement(
	request: ResourceRequest,
	profiles: ResourceProfile[],
): Requirement {
	const named =
		request.profile && request.profile !== "custom"
			? profiles.find((p) => p.name === request.profile)
			: undefined;
	if (request.profile && request.profile !== "custom" && !named) {
		const known = profiles.map((p) => p.name).join(", ");
		throw new DomainError(
			`Unknown resource profile "${request.profile}". This device offers: ${known}.`,
		);
	}
	return {
		cpu: request.cpu ?? named?.cpu ?? 0,
		memory: request.memory ?? named?.memory ?? 0,
		disk: request.disk ?? 0,
	};
}

/** Lists every resource the device cannot currently provide; empty means it fits. */
export function findShortfalls(
	need: Requirement,
	have: ResourceAllocations,
): string[] {
	const checks = [
		["CPU", need.cpu, have.cpu.available, "units"],
		["memory", need.memory, have.memory.available, "MB"],
		["disk", need.disk, have.disk.available, "MB"],
	] as const;
	return checks
		.filter(([, needed, available]) => needed > available)
		.map(
			([name, needed, available, unit]) =>
				`${name}: needs ${needed} ${unit}, ${available} ${unit} available`,
		);
}
