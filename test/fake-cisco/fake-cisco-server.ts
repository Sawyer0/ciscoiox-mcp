import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { AddressInfo } from "node:net";
import { FakeIox } from "./fake-iox";
import { FakeQuali } from "./fake-quali";
import {
	type FakeRequest,
	json,
	type RouteHandler,
	readRequest,
	writeReply,
} from "./http-kit";

export interface FakeCiscoOptions {
	tls?: { key: string; cert: string };
}

/** One local HTTP(S) server that answers like the DevNet Quali portal and an IOx device. */
export class FakeCiscoServer {
	readonly quali = new FakeQuali();
	readonly iox = new FakeIox();
	readonly requests: FakeRequest[] = [];
	private readonly handlers: RouteHandler[] = [
		(r) => this.quali.handle(r),
		(r) => this.iox.handle(r),
	];
	private server: Server | undefined;

	addHandler(handler: RouteHandler): void {
		this.handlers.push(handler);
	}

	async start(options: FakeCiscoOptions = {}): Promise<number> {
		const server = options.tls
			? createHttpsServer(options.tls)
			: createHttpServer();
		server.on("request", async (req, res) => {
			const request = await readRequest(req);
			this.requests.push(request);
			const reply = this.handlers.reduce<ReturnType<RouteHandler>>(
				(found, handler) => found ?? handler(request),
				undefined,
			);
			writeReply(
				res,
				reply ?? json(404, { message: `No fake route for ${request.path}` }),
			);
		});
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		this.server = server;
		return (server.address() as AddressInfo).port;
	}

	async stop(): Promise<void> {
		const server = this.server;
		if (!server) return;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}
