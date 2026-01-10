# Specification: MVP: Core Connectivity & Lab Lifecycle

## Overview
This track focuses on establishing the core foundation of the `dockerIOx-sandbox-mcp` server. It includes project initialization, environment configuration, and the implementation of the Quali CloudShell API module to manage the Cisco DevNet Sandbox reservation lifecycle.

## Functional Requirements
- Initialize a Bun-based TypeScript project.
- Implement robust environment variable validation using Zod.
- Create a modular API client for Quali CloudShell (`src/quali`).
- Implement authentication logic, including handling expiring CloudShell tokens via Axios interceptors.
- Expose MCP tools for:
    - `get_reservation_status`: Retrieves the remaining time and status of the current sandbox reservation.
    - `extend_reservation`: Extends the sandbox reservation time to prevent premature termination.

## Non-Functional Requirements
- **Type Safety:** 100% TypeScript coverage in strict mode.
- **Code Quality:** Automated linting and formatting via Biome.
- **Testability:** Modular design with >80% unit test coverage using mocked API responses.

## Acceptance Criteria
- [ ] `bun run check` passes (Linting, Types, Tests).
- [ ] MCP server starts and successfully responds to list-tools requests.
- [ ] `get_reservation_status` returns correct time remaining from the Quali API.
- [ ] `extend_reservation` successfully communicates with the Quali API to increase time.
- [ ] Expiring tokens are automatically handled without server restart.
