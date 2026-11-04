# ciscoiox-mcp

> A Model Context Protocol (MCP) server that lets an AI assistant work with a Cisco DevNet IOx sandbox: keep the lab reservation alive, and package, deploy, run, observe and remove IOx apps on the device.

![CI](https://github.com/Sawyer0/ciscoiox-mcp/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)

## What it does

The server speaks MCP over stdio, so any MCP client (Claude Desktop, Cursor, the MCP Inspector) can call its tools. It talks to two systems:

- **The DevNet lab portal** (Quali CloudShell Sandbox API v2) to read and extend your sandbox reservation.
- **The IOx device** (the Cisco Application Framework, or CAF, REST API that IOx Local Manager and `ioxclient` use) to manage apps.

Each integration is optional: tools are registered only for the systems you configure.

### Tools

| Tool | What it does |
| --- | --- |
| `get_reservation_status` | Active sandbox (first `Ready`, then `Setup`/`Pending`, or `LAB_ID`) with start/end time and minutes remaining |
| `extend_reservation` | Extends the sandbox by N minutes (sent as an ISO 8601 duration) |
| `get_platform_status` | Device info, total and free CPU/memory/disk, and resource profiles |
| `list_apps` / `get_app` | Installed apps with state, version and reserved resources |
| `deploy_app` | Uploads a `.tar`/`.tar.gz` package, or validates a directory's `package.yaml` and builds `package.tar` from it; optionally activates and starts |
| `activate_app` | Reserves resources for a `DEPLOYED` app (profile or explicit CPU/memory/disk) |
| `start_app` / `stop_app` / `deactivate_app` | Lifecycle steps, checked against the IOx state rules first |
| `remove_app` | Uninstalls an app; `force: true` stops and deactivates it first |
| `list_app_logs` / `tail_app_log` | Lists an app's log files and returns the last N lines of one |
| `get_app_metrics` | App state plus memory (KB), CPU (%), network (bytes) and disk (MB) |

Before anything is uploaded or activated, the server checks that the transition is allowed (`DEPLOYED → ACTIVATED → RUNNING ⇄ STOPPED → DEPLOYED`) and that the device has enough free CPU, memory and disk for the requested profile. Failures come back as MCP tool errors with a plain explanation, not stack traces.

Logs are fetched on request (tail), not streamed.

## Status: what has and has not been verified

Everything above runs end to end in CI against local fakes of the portal and the device. It has **not** been run against real Cisco hardware yet. Cisco does not publish a formal reference for the CAF REST API, so the endpoints fall into two groups (see [`src/adapters/iox/iox-routes.ts`](src/adapters/iox/iox-routes.ts)):

- **Documented** in Cisco DevNet pages or Cisco-hosted examples: token service (`POST /tokenservice`, `X-Token-Id`), `/apps`, `/apps/<id>`, `POST /apps/<id>/state?action=…`, `/platform/sysinfo`, and the log/metrics/resource field names.
- **Inferred** from `ioxclient` behaviour, needing confirmation on a device: package upload (`POST /apps` with `X-App-Id` and an octet-stream body), `DELETE /apps/<id>`, `GET /apps/<id>/logs`, `GET /apps/<id>/metrics`, `GET /platform/resource/profiles` and `/platform/resource/allocations`. If one differs on your device, it is a one-line change in `iox-routes.ts`.

The Quali side follows the published CloudShell Sandbox API v2 reference (login, sandboxes, sandbox details, extend).

## Architecture

Ports and adapters: the core knows nothing about HTTP, MCP or the file system.

```
 MCP client ──stdio──▶ src/mcp            tools: input schemas, error → MCP result
                         │
                         ▼
                      src/services        LabService, AppLifecycleService, AppInsightsService, quota
                         │ uses ports      (pure logic, tested with in-memory fakes)
                         ▼
                      src/domain          types, state rules, errors, gateway interfaces
                         ▲ implemented by
                         │
                      src/adapters        QualiSandboxApi (HTTP)  IoxCafApi (HTTPS)  NodePackageFiles (fs)
                      src/packaging       package.yaml validation, ustar writer
```

`src/composition.ts` wires adapters into services from the validated config (`src/config/env.ts`); `src/index.ts` only loads `.env`, builds the server and connects stdio. stdout is reserved for the protocol; logs go to stderr.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 20.12+ or [Bun](https://bun.sh) 1.x to run the server (installing from a clone also uses Bun, since the lockfile is `bun.lock`)
- A Cisco DevNet IOx sandbox reservation and its VPN (Cisco AnyConnect), or any IOx device you can reach

### Install and configure

```bash
git clone https://github.com/Sawyer0/ciscoiox-mcp.git
cd ciscoiox-mcp
bun install            # also builds dist/index.js for Node (the prepare script)
cp .env.example .env   # fill in the portal and/or device credentials
```

`bun run build` rebuilds `dist/index.js`, a single ESM bundle with a `#!/usr/bin/env node` shebang. It is also the package's `ciscoiox-mcp` bin.

| Variable | Default | Purpose |
| --- | --- | --- |
| `QUALI_PORTAL_HOST` | – | Enables the lab tools |
| `QUALI_PORTAL_PORT` | `82` | CloudShell Sandbox API port |
| `QUALI_DOMAIN`, `QUALI_USER`, `QUALI_PASS` | `Global`, –, – | Portal login |
| `LAB_ID` | – | Pin a sandbox id instead of auto-selecting |
| `IOX_HOST` | – | Enables the IOx tools |
| `IOX_PORT`, `IOX_SCHEME` | `8443`, `https` | Device API address |
| `IOX_USER`, `IOX_PASS` | – | Local Manager credentials |
| `IOX_TLS_VERIFY` | `false` | Sandbox devices use self-signed certificates |

Run it directly with `node dist/index.js` or `bun start` (both wait for an MCP client on stdin), or try it with the MCP Inspector: `npx @modelcontextprotocol/inspector node dist/index.js`. The package is not published to npm; `npx github:Sawyer0/ciscoiox-mcp` installs it from GitHub, builds it and runs it with Node.

### Use it from Claude Desktop or Cursor

Add the server to `claude_desktop_config.json` (Claude Desktop) or `.cursor/mcp.json` (Cursor). Pick one of the launch styles below; the `env` block is the same for all of them, and any variable from the table above can go in it.

**Node, from a clone** (run `bun install` or `bun run build` first; use absolute paths):

```json
{
  "mcpServers": {
    "ciscoiox": {
      "command": "node",
      "args": ["/absolute/path/to/ciscoiox-mcp/dist/index.js"],
      "env": {
        "QUALI_PORTAL_HOST": "10.10.20.10",
        "QUALI_USER": "developer",
        "QUALI_PASS": "your-password",
        "IOX_HOST": "10.10.20.51",
        "IOX_USER": "cisco",
        "IOX_PASS": "your-password"
      }
    }
  }
}
```

**Node via npx, straight from GitHub** (no clone; the first launch installs and builds, so it is slower):

```json
{
  "mcpServers": {
    "ciscoiox": {
      "command": "npx",
      "args": ["-y", "github:Sawyer0/ciscoiox-mcp"],
      "env": {
        "QUALI_PORTAL_HOST": "10.10.20.10",
        "QUALI_USER": "developer",
        "QUALI_PASS": "your-password",
        "IOX_HOST": "10.10.20.51",
        "IOX_USER": "cisco",
        "IOX_PASS": "your-password"
      }
    }
  }
}
```

**Bun, from a clone** (runs the TypeScript source, no build step):

```json
{
  "mcpServers": {
    "ciscoiox": {
      "command": "bun",
      "args": ["/absolute/path/to/ciscoiox-mcp/src/index.ts"],
      "env": {
        "QUALI_PORTAL_HOST": "10.10.20.10",
        "QUALI_USER": "developer",
        "QUALI_PASS": "your-password",
        "IOX_HOST": "10.10.20.51",
        "IOX_USER": "cisco",
        "IOX_PASS": "your-password"
      }
    }
  }
}
```

Then ask things like "how long is left on my sandbox?", "deploy ./my-app and start it", or "why did hello_iox stop? show me the watchdog log". `deploy_app` takes a path on the machine running the server.

## Development

```bash
bun run lint        # biome lint + format check, warnings fail
bun run typecheck   # tsc --noEmit (strict, noUncheckedIndexedAccess)
bun run test        # unit, adapter and end-to-end tests
bun run coverage    # unit + adapter tests with a v8 coverage report and thresholds
bun run test:e2e    # end-to-end tests against bun src/index.ts
bun run build && bun run test:e2e:node   # the same suite against node dist/index.js
```

How the tests prove it works:

- **Unit tests** cover the services, quota rules, descriptor parsing and tar writer with in-memory fakes.
- **Adapter tests** run the real HTTP clients against strict, stateful fakes of CloudShell and CAF (`test/fake-cisco/`). The fakes reject wrong paths, methods, content types, bodies and missing tokens, and record each as a contract violation; tests fail on any violation.
- **End-to-end tests** (`test/e2e/`) spawn the server as a child process (`bun src/index.ts` by default, `node dist/index.js` with `E2E_RUNTIME=node`) and drive every tool through a real MCP client over stdio, asserting on what the fake portal and device hold afterwards. A workflow test checks the sandbox, packages `test/fixtures/hello-app`, installs, activates, starts, reads metrics and logs, stops, deactivates and uninstalls it, and verifies the uploaded archive with the system `tar`.

CI (GitHub Actions) runs lint, typecheck, tests with coverage and the end-to-end suite under Bun on every push and pull request, then builds `dist/` and runs the end-to-end suite again with `node dist/index.js` on Node 20 and 22.

## License

Apache License 2.0. See [LICENSE](LICENSE).
