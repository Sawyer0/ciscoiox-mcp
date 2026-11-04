import type { FakeRequest, Reply } from "./http-kit";
import { json } from "./http-kit";

/**
 * Records every request a fake had to reject. Tests assert this stays empty
 * on the happy path, so a wrong path, header or body fails loudly instead of
 * being papered over by a lenient fake.
 */
export class ContractLog {
	readonly violations: string[] = [];

	reject(request: FakeRequest, status: number, reason: string): Reply {
		this.violations.push(`${request.method} ${request.path}: ${reason}`);
		return json(status, {
			description: reason,
			errorcode: -1,
			message: "Error",
		});
	}
}

export const contentType = (request: FakeRequest): string =>
	String(request.headers["content-type"] ?? "")
		.split(";")[0]
		?.trim()
		.toLowerCase() ?? "";

/** Parses a JSON body, returning undefined when it is not a JSON object. */
export const jsonObject = (
	request: FakeRequest,
): Record<string, unknown> | undefined => {
	try {
		const value: unknown = JSON.parse(request.body.toString("utf8"));
		return value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
};

export const onlyKeys = (
	value: Record<string, unknown>,
	allowed: string[],
): string[] => Object.keys(value).filter((key) => !allowed.includes(key));
