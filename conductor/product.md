# Initial Concept
i want to build a rust MCP using https://github.com/modelcontextprotocol/rust-sdk/tree/main , you need to create a new directory for this

# Product Guide: dockerIOx-sandbox-mcp

## Overview
This project aims to build a Model Context Protocol (MCP) server in Rust that interfaces with Cisco IOx sandboxes. It will allow AI agents (like Gemini) to deploy Docker containers, manage their lifecycle, and retrieve diagnostics/logs from IOx-compatible environments, specifically targeting the Cisco DevNet Sandbox.

## Target Users
- **Developers:** Who need to interface with Docker/IOx sandboxes via LLMs (e.g., using Gemini or Claude) to orchestrate and manage containerized applications.

## Goals & Value Propositions
- **Secure Execution Environment:** Provide a controlled interface for running and managing code within Docker/IOx sandboxes via LLM tools.
- **Diagnostic Visibility:** Enable real-time monitoring and log retrieval from IOx containers directly into an LLM's context for troubleshooting.
- **Simplified Abstraction:** Abstract the complexity of Docker/IOx APIs into intuitive MCP tools, facilitating easier integration with AI agents.
- **Deployment Automation:** Streamline the deployment of Docker containers onto Cisco IOx infrastructure.

## Core Features
- **Container Management:** Tools to List, Start, Stop, and Remove containers on the IOx sandbox.
- **Lab Lifecycle:** Tools to check remaining reservation time (`get_reservation_status`) and extend the session (`extend_reservation`) via Quali CloudShell.
- **Smart Deployment:** Automation to handle IOx package uploads (converting Docker builds to IOx `.tar` packages if needed).
- **Real-time Log Streaming:** Capability to fetch and stream logs from specific containers to the LLM.
- **Resource Monitoring:** Tools to retrieve CPU, memory, and network usage statistics to prevent quota errors.

## Constraints & Requirements
- **Authentication:** Must securely manage dual credentials (CloudShell Token with expiration/refresh logic, and IOx Basic Auth `admin`/`cisco123`). No hardcoded secrets; use `.env` or secure storage.
- **Network Isolation:** The server must operate locally ("localhost") where the Cisco AnyConnect VPN tunnel is active, as sandbox devices (e.g., `10.10.20.50`) are on a private network. Cloud deployment is not feasible.
- **Resource Quotas:**
    - **Time:** Must account for the reservation timer of the sandbox; the environment is destroyed when the reservation ends.
    - **Compute:** Must handle potential "insufficient resources" errors due to limited RAM on virtual IOx devices.
- **Ephemeral State:** The sandbox is temporary. The MCP server must not rely on the sandbox for long-term persistence; all source code and configurations must be maintained locally.