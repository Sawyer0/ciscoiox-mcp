import dotenv from "dotenv";
dotenv.config();
import { getReservationStatus } from "../src/quali/reservation";
import { extendReservation } from "../src/quali/extension";

console.log("Checking reservation status...");
try {
    const status = await getReservationStatus();
    console.log("Status:", status);

    console.log("Attempting to extend reservation by 1 minute...");
    await extendReservation(1);
    console.log("Extension successful.");
} catch (error) {
    console.error("Error:", error);
}
