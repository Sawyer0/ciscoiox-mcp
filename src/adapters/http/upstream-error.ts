import { isAxiosError } from "axios";
import { UpstreamError } from "../../domain/errors";

const detailOf = (data: unknown): string | undefined => {
	if (typeof data === "string" && data.trim() !== "") return data.trim();
	if (data && typeof data === "object") {
		const record = data as Record<string, unknown>;
		for (const key of ["description", "message", "Message", "error"]) {
			const value = record[key];
			if (typeof value === "string" && value !== "") return value;
		}
	}
	return undefined;
};

/** Converts an HTTP client failure into an UpstreamError with a readable message. */
export function toUpstreamError(
	error: unknown,
	service: string,
): UpstreamError {
	if (error instanceof UpstreamError) return error;
	if (isAxiosError(error)) {
		const status = error.response?.status;
		if (status === undefined) {
			return new UpstreamError(
				`${service} is unreachable (${error.code ?? error.message}). Check the VPN and host settings.`,
			);
		}
		const detail = detailOf(error.response?.data);
		return new UpstreamError(
			`${service} returned HTTP ${status}${detail ? `: ${detail}` : ""}`,
			status,
		);
	}
	const message = error instanceof Error ? error.message : String(error);
	return new UpstreamError(`${service} request failed: ${message}`);
}
