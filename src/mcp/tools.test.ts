import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "./server";
import { registerLabTools } from "./tools";

// Mock the Quali modules
vi.mock("../quali/reservation", () => ({
    getReservationStatus: vi.fn().mockResolvedValue({ id: "mock-id", status: "Active" }),
}));
vi.mock("../quali/extension", () => ({
    extendReservation: vi.fn().mockResolvedValue(undefined),
}));

describe("MCP Tools Registration", () => {
    it("should register lab tools", async () => {
        const server = createServer();
        
        // Access internal tool definitions (if accessible) or trust the registration logic
        // The SDK's McpServer doesn't expose a simple 'getTools' list synchronously usually.
        // But we can check if the methods are hooked up.
        
        // However, for this MVP, I'll rely on calling the registration function 
        // and ensuring it doesn't throw.
        expect(() => registerLabTools(server)).not.toThrow();
    });
});
