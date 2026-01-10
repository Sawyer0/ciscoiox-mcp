# Plan: Production: Full IOx Feature Set & Release

## Phase 1: IOx Module Core
- [ ] Task: Implement `src/iox` client structure with Axios
- [ ] Task: Implement Basic Auth interceptor for IOx Local Manager
- [ ] Task: Write Tests: IOx Authentication and Connectivity
- [ ] Task: Conductor - User Manual Verification 'IOx Module Core' (Protocol in workflow.md)

## Phase 2: Container Lifecycle Management
- [ ] Task: Write Tests: Container List, Start, Stop, Remove
- [ ] Task: Implement: `list_containers` (Mapping IOx JSON to clean output)
- [ ] Task: Implement: `start_container` and `stop_container`
- [ ] Task: Implement: `remove_container`
- [ ] Task: Register Lifecycle tools in MCP server
- [ ] Task: Conductor - User Manual Verification 'Container Lifecycle Management' (Protocol in workflow.md)

## Phase 3: Smart Deployment & Packaging
- [ ] Task: Research/Validate IOx Package Upload API (FormData handling in Bun)
- [ ] Task: Write Tests: Application Upload logic (Mocked)
- [ ] Task: Implement: `deploy_app` tool (Upload .tar + Activate)
- [ ] Task: Implement: Error handling for "Insufficient Resources" during deploy
- [ ] Task: Conductor - User Manual Verification 'Smart Deployment & Packaging' (Protocol in workflow.md)

## Phase 4: Observability & Diagnostics
- [ ] Task: Write Tests: Log retrieval and Stats parsing
- [ ] Task: Implement: `get_app_logs` tool
- [ ] Task: Implement: `get_system_stats` tool
- [ ] Task: Register Observability tools in MCP server
- [ ] Task: Conductor - User Manual Verification 'Observability & Diagnostics' (Protocol in workflow.md)

## Phase 5: Production Release
- [ ] Task: Configure `bun build` script for standalone compilation
- [ ] Task: Create `README.md` usage instructions for the binary
- [ ] Task: Run full "Live Test" against actual DevNet Sandbox (Manual)
- [ ] Task: Compile and verify the final standalone executable
- [ ] Task: Conductor - User Manual Verification 'Production Release' (Protocol in workflow.md)
