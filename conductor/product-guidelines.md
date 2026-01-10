# Product Guidelines: dockerIOx-sandbox-mcp

## Communication Style
- **Helpful & Conversational:** Tool descriptions and documentation should be written in natural language, explaining the *intent* and *context* of each tool (e.g., "Use this tool when the user wants to extend their lab time"). This approach acts as few-shot prompting for the LLM (Gemini), helping it understand *how* and *when* to use a tool, rather than just providing technical definitions.

## Error Handling
- **Detailed & Actionable:** The server must intercept raw API errors and translate them into clear, actionable messages for the LLM.
    - *Example:* Instead of a generic 500 error, return: "The deployment failed because the IOx device at 10.10.20.50 is out of RAM. Please try stopping an existing container first."
    - *Goal:* Empower the LLM to autonomously resolve issues (e.g., stop a container and retry deployment) without human intervention.

## Codebase Structure
- **Modular & Domain-Driven:** The project is divided into distinct modules based on the disparate external systems it interacts with.
    - `src/quali`: Handles all logic for the Quali CloudShell API (Lab reservation, tokens, time management).
    - `src/iox`: Handles all logic for the Cisco IOx Local Manager API (Container lifecycle, deployment, logs).
    - `src/mcp`: Handles the Model Context Protocol server logic and routing.
    - *Rationale:* This separation ensures clear boundaries between the "Lab" universe and the "Device" universe, simplifying maintenance and future expansion.

## Development Principles
- **Safety First:** Given the ephemeral and resource-constrained nature of the sandbox, all operations should be validated before execution (e.g., check lab time before starting a long deployment).
- **Local-First:** All state and configuration reside on the local machine ("localhost"). No dependency on external cloud persistence.