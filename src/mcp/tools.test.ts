import { describe, it, expect, vi } from "vitest";
import { createServer } from "./server";
import { registerLabTools } from "./tools";

// Mock QualiClient class
vi.mock("../quali/client", () => {
    return {
        QualiClient: vi.fn().mockImplementation(() => ({
            getReservationStatus: vi.fn().mockResolvedValue({ id: "mock-id", status: "Active" }),
            extendReservation: vi.fn().mockResolvedValue("Extended"),
        })),
    };
});

describe("MCP Tools Registration", () => {
    it("should register lab tools", async () => {
        const server = createServer();
        
        expect(() => registerLabTools(server)).not.toThrow();
    });
});