import axios, { type AxiosInstance } from "axios";
import { config } from "../config";

export const createQualiClient = (): AxiosInstance => {
	const client = axios.create({
		baseURL: "https://devnetsandbox.cisco.com/rm/api",
		headers: {
			Authorization: `Bearer ${config.QUALI_TOKEN}`,
			"Content-Type": "application/json",
		},
	});

	client.interceptors.response.use(
		(response) => response,
		(error) => {
			if (error.response?.status === 401) {
				throw new Error(
					"CloudShell Token Expired or Invalid. Please update QUALI_TOKEN in your .env file.",
				);
			}
			return Promise.reject(error);
		},
	);

	return client;
};
