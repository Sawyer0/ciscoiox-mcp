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

	return client;
};
