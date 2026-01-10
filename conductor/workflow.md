# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` *before* implementation
3. **Test-Driven Development:** Write unit tests before implementing functionality
4. **Meaningful Code Coverage:** Aim for >80% code coverage, but prioritize testing critical functionality over raw numbers.
5. **User Experience First:** Every decision should prioritize user experience
6. **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode tools (tests, linters) to ensure single execution.

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1. **Select Task:** Choose the next available task from `plan.md` in sequential order

2. **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from `[ ]` to `[~]`

3. **Write Failing Tests (Red Phase):**
   - Create a new test file for the feature or bug fix.
   - Write one or more unit tests that clearly define the expected behavior and acceptance criteria for the task.
   - **CRITICAL:** Run the tests and confirm that they fail as expected. This is the "Red" phase of TDD. Do not proceed until you have failing tests.

4. **Implement to Pass Tests (Green Phase):**
   - Write the minimum amount of application code necessary to make the failing tests pass.
   - Run the test suite again and confirm that all tests now pass. This is the "Green" phase.

5. **Refactor (Optional but Recommended):**
   - With the safety of passing tests, refactor the implementation code and the test code to improve clarity, remove duplication, and enhance performance without changing the external behavior.
   - Rerun tests to ensure they still pass after refactoring.

6. **Verify Coverage:** Run coverage reports using the project's chosen tools:
   ```bash
   bun test --coverage
   ```
   Target: >80% coverage for new code.

7. **Document Deviations:** If implementation differs from tech stack:
   - **STOP** implementation
   - Update `tech-stack.md` with new design
   - Add dated note explaining the change
   - Resume implementation

8. **Commit Code Changes:**
   - Stage all code changes related to the task.
   - Propose a clear, concise commit message e.g, `feat(iox): Add container start functionality`.
   - Perform the commit.

9. **Attach Task Summary with Git Notes:**
   - **Step 9.1: Get Commit Hash:** Obtain the hash of the *just-completed commit* (`git log -1 --format="%H"`).
   - **Step 9.2: Draft Note Content:** Create a detailed summary for the completed task. This should include the task name, a summary of changes, a list of all created/modified files, and the core "why" for the change.
   - **Step 9.3: Attach Note:** Use the `git notes` command to attach the summary to the commit.
     ```bash
     # The note content from the previous step is passed via the -m flag.
     git notes add -m "<note content>" <commit_hash>
     ```

10. **Get and Record Task Commit SHA:**
    - **Step 10.1: Update Plan:** Read `plan.md`, find the line for the completed task, update its status from `[~]` to `[x]`, and append the first 7 characters of the *just-completed commit's* commit hash.
    - **Step 10.2: Write Plan:** Write the updated content back to `plan.md`.

11. **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message (e.g., `conductor(plan): Mark task 'Create user model' as complete`).

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** This protocol is executed immediately after a task is completed that also concludes a phase in `plan.md`.

1.  **Announce Protocol Start:** Inform the user that the phase is complete and the verification and checkpointing protocol has begun.

2.  **Ensure Test Coverage for Phase Changes:**
    -   **Step 2.1: Determine Phase Scope:** To identify the files changed in this phase, you must first find the starting point. Read `plan.md` to find the Git commit SHA of the *previous* phase's checkpoint. If no previous checkpoint exists, the scope is all changes since the first commit.
    -   **Step 2.2: List Changed Files:** Execute `git diff --name-only <previous_checkpoint_sha> HEAD` to get a precise list of all files modified during this phase.
    -   **Step 2.3: Verify and Create Tests:** For each file in the list:
        -   **CRITICAL:** First, check its extension. Exclude non-code files (e.g., `.json`, `.md`, `.yaml`).
        -   For each remaining code file, verify a corresponding test file exists.
        -   If a test file is missing, you **must** create one. Before writing the test, **first, analyze other test files in the repository to determine the correct naming convention and testing style.** The new tests **must** validate the functionality described in this phase's tasks (`plan.md`).

3.  **Execute Automated Tests with Proactive Debugging:**
    -   Before execution, you **must** announce the exact shell command you will use to run the tests.
    -   **Example Announcement:** "I will now run the automated test suite to verify the phase. **Command:** `bun test`"
    -   Execute the announced command.
    -   If tests fail, you **must** inform the user and begin debugging. You may attempt to propose a fix a **maximum of two times**. If the tests still fail after your second proposed fix, you **must stop**, report the persistent failure, and ask the user for guidance.

4.  **Propose a Detailed, Actionable Manual Verification Plan:**
    -   **CRITICAL:** To generate the plan, first analyze `product.md`, `product-guidelines.md`, and `plan.md` to determine the user-facing goals of the completed phase.
    -   You **must** generate a step-by-step plan that walks the user through the verification process, including any necessary commands and specific, expected outcomes.
    -   The plan you present to the user **must** follow this format:

        **For this MCP Server:**
        ```
        The automated tests have passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1.  **Ensure your `.env` is configured with valid Sandbox credentials.**
        2.  **Start the MCP server locally:** `bun run dev`
        3.  **Trigger a specific tool (via a test script or MCP inspector):** `bun run scripts/test-tool.ts --tool start_container`
        4.  **Confirm that you see:** The container ID returned in the logs and the container running on the IOx sandbox (if accessible).
        ```

5.  **Await Explicit User Feedback:**
    -   After presenting the detailed plan, ask the user for confirmation: "**Does this meet your expectations? Please confirm with yes or provide feedback on what needs to be changed.**"
    -   **PAUSE** and await the user's response. Do not proceed without an explicit yes or confirmation.

6.  **Create Checkpoint Commit:**
    -   Stage all changes. If no changes occurred in this step, proceed with an empty commit.
    -   Perform the commit with a clear and concise message (e.g., `conductor(checkpoint): Checkpoint end of Phase X`).

7.  **Attach Auditable Verification Report using Git Notes:**
    -   **Step 8.1: Draft Note Content:** Create a detailed verification report including the automated test command, the manual verification steps, and the user's confirmation.
    -   **Step 8.2: Attach Note:** Use the `git notes` command and the full commit hash from the previous step to attach the full report to the checkpoint commit.

8.  **Get and Record Phase Checkpoint SHA:**
    -   **Step 7.1: Get Commit Hash:** Obtain the hash of the *just-created checkpoint commit* (`git log -1 --format="%H"`).
    -   **Step 7.2: Update Plan:** Read `plan.md`, find the heading for the completed phase, and append the first 7 characters of the commit hash in the format `[checkpoint: <sha>]`.
    -   **Step 7.3: Write Plan:** Write the updated content back to `plan.md`.

9. **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message following the format `conductor(plan): Mark phase '<PHASE NAME>' as complete`.

10.  **Announce Completion:** Inform the user that the phase is complete and the checkpoint has been created, with the detailed verification report attached as a git note.

### Quality Gates

Before marking any task complete, verify:

- [ ] All tests pass (`bun test`)
- [ ] Code coverage meets requirements (>80%)
- [ ] Code follows project's code style guidelines
- [ ] No linting or formatting errors (`bun run lint` / `bunx biome check`)
- [ ] All public functions/methods are documented (JSDoc)
- [ ] Type safety is enforced (Strict TypeScript)
- [ ] No security vulnerabilities introduced

## Development Commands

### Setup
```bash
bun install
```

### Daily Development
```bash
bun run dev      # Start the MCP server in watch mode
bun test         # Run unit tests
bun run lint     # Lint and format code (Biome)
```

### Before Committing
```bash
bun run check    # Run linting, type checking, and tests
```

## Testing Requirements

### Unit Testing
- Every module (`src/iox`, `src/quali`) must have corresponding tests.
- Use `vitest` with `axios-mock-adapter` (or similar) to mock external API calls.
- Test both success (200 OK) and failure (401, 500) API scenarios.

### Integration Testing (Hybrid)
- **CI/Standard:** Mock all external calls to avoid VPN dependency.
- **Live/Manual:** Before major checkpoints, perform a "Live Test" by connecting to the actual DevNet Sandbox.
    - Verify authentication flows.
    - Verify actual container deployment on a real IOx device.

## Code Review Process

### Self-Review Checklist
Before requesting review:

1. **Functionality**
   - Feature works as specified
   - Edge cases (API timeouts, invalid tokens) handled
   - Error messages are user-friendly

2. **Code Quality**
   - Follows style guide
   - DRY principle applied
   - Clear variable/function names
   - Appropriate comments

3. **Testing**
   - Unit tests comprehensive (Mocked)
   - Integration tests pass (Mocked)
   - Coverage adequate (>80%)

4. **Security**
   - No hardcoded secrets
   - Input validation present (Zod schemas)

## Commit Guidelines

### Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintenance tasks

### Examples
```bash
git commit -m "feat(auth): Add CloudShell token refresh logic"
git commit -m "fix(iox): Correct container start timeout"
git commit -m "test(mcp): Add tests for tool definition schema"
```

## Definition of Done

A task is complete when:

1. All code implemented to specification
2. Unit tests written and passing (Mocked)
3. Code coverage meets project requirements (>80%)
4. Documentation complete (if applicable)
5. Code passes all configured linting (Biome) and static analysis checks
6. **For Major Features:** Verified against a live DevNet Sandbox (Manual Check)
7. Implementation notes added to `plan.md`
8. Changes committed with proper message
9. Git note with task summary attached to the commit

## Deployment Workflow

### Strategy
**Local Execution:** This MCP server is designed to run locally (`localhost`) or on a secure internal server with VPN access.

### Pre-Release Checklist
- [ ] All tests passing
- [ ] Coverage >80%
- [ ] No linting errors
- [ ] Environment variables configured correctly in `.env.example`
- [ ] Verified against live Sandbox (if applicable)

### Release Steps
1. Merge feature branch to main
2. Verify local build: `bun run build`
3. (Optional) Compile to standalone executable: `bun build --compile --target=bun-windows-x64-modern ./src/index.ts --outfile dockerIOx-mcp`
4. Tag release with version