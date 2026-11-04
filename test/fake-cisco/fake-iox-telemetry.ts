import type { FakeApp } from "./fake-iox";

/** Resource profiles as listed by `ioxclient platform resourcemanager profiles`. */
export const PROFILES: Record<
	string,
	{ cpu: number; memory: number; vcpu: number }
> = {
	default: { cpu: 200, memory: 64, vcpu: 1 },
	"c1.tiny": { cpu: 100, memory: 32, vcpu: 1 },
	"c1.small": { cpu: 200, memory: 64, vcpu: 1 },
	"c1.medium": { cpu: 400, memory: 128, vcpu: 1 },
	"c1.large": { cpu: 600, memory: 256, vcpu: 1 },
	"c1.xlarge": { cpu: 1200, memory: 256, vcpu: 1 },
};

const TOTAL = { cpu: 1000, memory: 512, disk: 256 };

/** Allocation report in the shape `ioxclient platform resourcemanager allocations` shows. */
export function allocationsFor(apps: FakeApp[]) {
	const reserved = apps.filter((a) => a.state !== "DEPLOYED");
	const sum = (key: "cpu" | "memory" | "disk") =>
		reserved.reduce((total, a) => total + a.reserved[key], 0);
	return {
		cpu: { total_cpu: TOTAL.cpu, available_cpu: TOTAL.cpu - sum("cpu") },
		memory: {
			total_memory: TOTAL.memory,
			available_memory: TOTAL.memory - sum("memory"),
		},
		disk: {
			total_persistent_disk: TOTAL.disk,
			available_persistent_disk: TOTAL.disk - sum("disk"),
		},
	};
}

/** Log lines reflect the app's real history, so tests see state-dependent output. */
export function logText(app: FakeApp, filename: string): string {
	if (filename === "watchDog.log") {
		return app.history
			.map((state, i) => `${i + 1}: ${app.id} entered ${state}`)
			.join("\n");
	}
	const runs = app.history.filter((s) => s === "RUNNING").length;
	return Array.from(
		{ length: runs * 3 },
		(_, i) => `${app.pkg.name} says hello #${i + 1}`,
	).join("\n");
}

/** Usage readings shaped like `ioxclient app metrics`; zero unless RUNNING. */
export function metricsFor(app: FakeApp) {
	const running = app.state === "RUNNING";
	return {
		memory: { current: running ? app.reserved.memory * 100 : 0, unit: "KB" },
		cpu: { current: running ? 1.5 : 0, unit: "percent" },
		network: { current: running ? 99601 : 0, unit: "bytes" },
		disk: { current: 0.03, unit: "MB" },
	};
}
