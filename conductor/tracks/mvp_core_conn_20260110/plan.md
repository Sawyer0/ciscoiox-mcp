# Plan: MVP: Core Connectivity & Lab Lifecycle

## Phase 1: Project Scaffolding
- [ ] Task: Initialize project with `bun init` and install core dependencies (`@modelcontextprotocol/sdk`, `axios`, `zod`, `dotenv`)
- [ ] Task: Configure Biome for linting and formatting
- [ ] Task: Set up TypeScript configuration (strict mode) and directory structure (`src/mcp`, `src/quali`, `src/iox`)
- [ ] Task: Implement Zod schema and validation logic for `.env` variables
- [ ] Task: Conductor - User Manual Verification 'Project Scaffolding' (Protocol in workflow.md)

## Phase 2: Quali Module Implementation
- [ ] Task: Implement basic Quali API client with Axios
- [ ] Task: Write Tests: Quali authentication and token refresh logic
- [ ] Task: Implement: CloudShell Token refresh interceptor
- [ ] Task: Write Tests: `get_reservation_status` functionality
- [ ] Task: Implement: `get_reservation_status` API call and data mapping
- [ ] Task: Write Tests: `extend_reservation` functionality
- [ ] Task: Implement: `extend_reservation` API call
- [ ] Task: Conductor - User Manual Verification 'Quali Module Implementation' (Protocol in workflow.md)

## Phase 3: MCP Server Integration
- [ ] Task: Initialize MCP server base and transport logic
- [ ] Task: Write Tests: Tool registration and dispatching
- [ ] Task: Implement: Register `get_reservation_status` and `extend_reservation` as MCP tools
- [ ] Task: Implement: Detailed, actionable error handling for Lab tools
- [ ] Task: Conductor - User Manual Verification 'MCP Server Integration' (Protocol in workflow.md)
