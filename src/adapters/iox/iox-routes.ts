/**
 * CAF REST paths, relative to https://<host>:<port>/iox/api/v2/hosting.
 *
 * Cisco does not publish a formal reference for this API. Paths marked
 * "documented" appear in Cisco DevNet pages or Cisco-hosted examples;
 * paths marked "inferred" follow the same resource layout and ioxclient
 * behaviour but have not been verified against hardware.
 */
const app = (appId: string) => `/apps/${encodeURIComponent(appId)}`;

export const IoxRoutes = {
	/** documented: POST with HTTP Basic auth returns { token: { id } } */
	token: "/tokenservice",
	/** documented: Cisco community example of platform info */
	sysinfo: "/platform/sysinfo",
	/** documented: path listed in CAF REST metrics */
	apps: "/apps",
	/** documented: "App is available at .../iox/api/v2/hosting/apps/<id>" */
	app,
	/** documented: POST /apps/<id>/state?action=<action> (DevNet Application Networking) */
	state: (appId: string) => `${app(appId)}/state`,
	/** inferred: per-app log listing behind "ioxclient app logs info" */
	logs: (appId: string) => `${app(appId)}/logs`,
	/** inferred: per-app metrics behind "ioxclient app metrics" */
	metrics: (appId: string) => `${app(appId)}/metrics`,
	/** inferred: resource manager data behind "ioxclient platform resourcemanager" */
	profiles: "/platform/resource/profiles",
	allocations: "/platform/resource/allocations",
} as const;
