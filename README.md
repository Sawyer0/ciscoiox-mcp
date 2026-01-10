# ciscoiox-sandbox-mcp

> **A Model Context Protocol (MCP) server for interfacing with Cisco IOx sandboxes via LLMs.**

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Status](https://img.shields.io/badge/Status-Development-yellow)

## Overview

`ciscoiox-sandbox-mcp` is a bridge between AI agents (like Gemini or Claude) and the Cisco DevNet Sandbox environment. It allows LLMs to:
1.  **Manage Lab Lifecycle:** Check reservation status and extend time via the Quali CloudShell API.
2.  **Orchestrate Containers:** Deploy, start, stop, and remove Docker containers on Cisco IOx devices.
3.  **Observe & Debug:** Stream logs and monitor resource usage (CPU/RAM) directly within the chat context.

This project is built with **Bun** and **TypeScript** for high performance and type safety, following a modular domain-driven architecture.

## Features

-   **Lab Management:** Tools to `get_reservation_status` and `extend_reservation` to prevent the sandbox from expiring while you work.
-   **Container Ops:** Full lifecycle management (Start/Stop/Remove/List) for containers on IOx.
-   **Smart Deployment:** Automates the packaging and upload of IOx applications (`.tar` bundles).
-   **Real-time Logs:** Fetches and streams container logs to the LLM for troubleshooting.
-   **Safety First:** Validates all operations against the ephemeral nature of the sandbox (e.g., resource quotas).

## Tech Stack

-   **Runtime:** [Bun](https://bun.sh) (v1.x)
-   **Language:** TypeScript (Strict Mode)
-   **Protocol:** [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/spec)
-   **Networking:** Axios (with Interceptors for auth)
-   **Testing:** Vitest
-   **Validation:** Zod

## Getting Started

### Prerequisites

-   [Bun](https://bun.sh) installed.
-   Access to a Cisco DevNet Sandbox (IOx enabled).
-   VPN access to the sandbox network (Cisco AnyConnect).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Sawyer0/ciscoiox-mcp.git
    cd ciscoiox-mcp
    ```

2.  Install dependencies:
    ```bash
    bun install
    ```

3.  Configure Environment:
    Copy `.env.example` to `.env` and fill in your credentials:
    ```bash
    cp .env.example .env
    ```

### Development

This project follows the **Conductor** spec-driven development framework.

-   **Start Dev Server:**
    ```bash
    bun run dev
    ```
-   **Run Tests:**
    ```bash
    bun test
    ```
-   **Lint & Format:**
    ```bash
    bun run lint
    ```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
