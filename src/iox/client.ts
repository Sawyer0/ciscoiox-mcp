import axios, { type AxiosInstance } from "axios";
import https from "https"; // Import https module

export class IoxClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, user: string, pass: string) {
    this.client = axios.create({
      baseURL: `${baseUrl}/api/v1`, // Correct baseURL
      auth: {
        username: user,
        password: pass,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Allows self-signed certificates, common in IOx
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
