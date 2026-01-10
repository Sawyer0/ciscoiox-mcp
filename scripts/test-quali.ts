import dotenv from "dotenv";
dotenv.config();
import { QualiClient } from "../src/quali/client";

console.log("Checking reservation status...");
const client = new QualiClient();

try {
    const status = await client.getReservationStatus();
    console.log("Status:", status);

    console.log("Attempting to extend reservation by 1 minute...");
    const result = await client.extendReservation(1);
    console.log(result);
} catch (error) {
    console.error("Error:", error);
}