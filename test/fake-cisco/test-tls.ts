import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let cached: { key: string; cert: string } | undefined;

/**
 * Self-signed key pair for the fake IOx HTTPS server, generated per test run
 * with the system openssl so no private key is committed to the repo.
 */
export function testTls(): { key: string; cert: string } {
	if (cached) return cached;
	const dir = mkdtempSync(join(tmpdir(), "fake-iox-tls-"));
	const key = join(dir, "key.pem");
	const cert = join(dir, "cert.pem");
	execFileSync(
		"openssl",
		[
			"req",
			"-x509",
			"-newkey",
			"rsa:2048",
			"-nodes",
			"-days",
			"1",
			"-subj",
			"/CN=fake-iox.test",
			"-addext",
			"subjectAltName=IP:127.0.0.1,DNS:localhost",
			"-keyout",
			key,
			"-out",
			cert,
		],
		{ stdio: "ignore" },
	);
	if (!existsSync(key) || !existsSync(cert))
		throw new Error("openssl did not create the test certificate");
	cached = { key: readFileSync(key, "utf8"), cert: readFileSync(cert, "utf8") };
	return cached;
}
