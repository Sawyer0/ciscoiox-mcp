# Technology Stack: dockerIOx-sandbox-mcp

## Core Runtime & Language
- **Language:** TypeScript (Strict Mode)
- **Runtime:** Bun (v1.x)
- **Package Manager:** Bun (Native)
- *Rationale:* Bun provides an all-in-one high-performance runtime with native TypeScript support, enabling rapid development and execution without complex build pipelines.

## Networking & API Interaction
- **HTTP Client:** Axios
- **Auth Strategy:** Axios Interceptors
- *Rationale:* Axios is used to manage the disparate Cisco and Quali APIs. Interceptors are critical for handling the logic of the expiring CloudShell tokens (auto-refresh/retry) and applying Basic Auth for the IOx Local Manager.

## Configuration & Security
- **Secret Management:** `.env` files (via `dotenv`)
- **Schema Validation:** Zod
- *Rationale:* Zod is used to validate that all required environment variables (e.g., `QUALI_TOKEN`, `IOX_HOST`, `LAB_ID`) are present and correctly formatted at startup, preventing runtime crashes due to missing configuration.

## Testing & Quality
- **Test Framework:** Vitest
- *Rationale:* Vitest offers a modern, fast testing experience that integrates seamlessly with Bun and TypeScript, supporting our modular architecture with comprehensive unit and integration tests.

## MCP Implementation
- **SDK:** Model Context Protocol TypeScript SDK (`@modelcontextprotocol/sdk`)
- *Rationale:* The official SDK ensures compliance with the MCP specification and provides the necessary abstractions for defining tools, resources, and prompts.