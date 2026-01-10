# Specification: Production: Full IOx Feature Set & Release

## Overview
This track builds upon the MVP connectivity foundation to implement the complete set of Cisco IOx capabilities. It focuses on the `src/iox` module, enabling the MCP server to manage the full lifecycle of containers, perform complex deployments, and provide deep observability, culminating in a standalone production release.

## Functional Requirements
- **IOx Module (`src/iox`):**
    - Implement a robust API client for the Cisco IOx Local Manager (Port 8443).
    - Handle Basic Authentication (`admin`/`cisco123`) securely.
- **Container Lifecycle Tools:**
    - `list_containers`: Show running/stopped apps with status.
    - `start_container` / `stop_container`: Manage app state.
    - `remove_container`: Clean up resources (Critical for the constrained sandbox).
- **Smart Deployment:**
    - `deploy_app`: Logic to upload IOx-compatible application packages.
    - **Context:** Must handle the specific IOx packaging requirements (package.yaml + artifacts in a .tar).
- **Observability Tools:**
    - `get_app_logs`: Stream or fetch logs for a specific app/container.
    - `get_system_stats`: Check CPU/Memory usage of the IOx device to prevent quota errors.
- **Production Build:**
    - Compile the Bun project into a single, standalone executable for easy distribution.

## Non-Functional Requirements
- **Error Intelligence:** Translate raw IOx errors (e.g., "Quota Exceeded") into actionable advice for the LLM (e.g., "Try removing stopped containers").
- **Performance:** Log streaming must be efficient and not flood the MCP context window.
- **Security:** Ensure IOx credentials are never leaked in logs.

## Acceptance Criteria
- [ ] All Container Lifecycle tools work against a live or mocked IOx sandbox.
- [ ] Deployment tool successfully uploads and activates a sample IOx app.
- [ ] Logs can be retrieved and displayed to the user.
- [ ] System stats accurately reflect device load.
- [ ] `bun build --compile` produces a working `.exe` (or binary) that runs without external dependencies.
