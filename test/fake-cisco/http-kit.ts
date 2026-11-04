import type { IncomingMessage, ServerResponse } from "node:http";

export interface FakeRequest {
	method: string;
	path: string;
	query: URLSearchParams;
	headers: IncomingMessage["headers"];
	body: Buffer;
}

export type Reply = { status: number; body?: unknown; contentType?: string };

export type RouteHandler = (request: FakeRequest) => Reply | undefined;

export const json = (status: number, body: unknown): Reply => ({
	status,
	body,
});

export const readRequest = async (
	req: IncomingMessage,
): Promise<FakeRequest> => {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	const url = new URL(req.url ?? "/", "http://fake");
	return {
		method: req.method ?? "GET",
		path: url.pathname,
		query: url.searchParams,
		headers: req.headers,
		body: Buffer.concat(chunks),
	};
};

export const writeReply = (res: ServerResponse, reply: Reply): void => {
	if (reply.body === undefined) {
		res.writeHead(reply.status).end();
		return;
	}
	if (typeof reply.body === "string") {
		res.writeHead(reply.status, {
			"Content-Type": reply.contentType ?? "text/plain",
		});
		res.end(reply.body);
		return;
	}
	res.writeHead(reply.status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(reply.body));
};

export const parseJson = (request: FakeRequest): Record<string, unknown> => {
	if (request.body.length === 0) return {};
	return JSON.parse(request.body.toString("utf8")) as Record<string, unknown>;
};
