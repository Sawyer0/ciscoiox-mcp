/** An expected failure whose message is safe and useful to show the model. */
export class DomainError extends Error {
	override name = "DomainError";
}

export class NotFoundError extends DomainError {
	override name = "NotFoundError";
}

export class InvalidStateError extends DomainError {
	override name = "InvalidStateError";
}

export class QuotaExceededError extends DomainError {
	override name = "QuotaExceededError";
}

export class PackageError extends DomainError {
	override name = "PackageError";
}

/** A remote API answered with an error or could not be reached. */
export class UpstreamError extends Error {
	override name = "UpstreamError";
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
	}
}
