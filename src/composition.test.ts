import { describe, expect, it } from "vitest";
import { buildServices, enabledGroups } from "./composition";

const quali = {
	baseUrl: "http://q/api",
	username: "u",
	password: "p",
	domain: "Global",
};
const iox = {
	baseUrl: "https://i/iox/api/v2/hosting",
	username: "u",
	password: "p",
	verifyTls: false,
};

describe("buildServices", () => {
	it("enables tool groups per configured integration", () => {
		expect(enabledGroups(buildServices({ quali }))).toEqual(["lab"]);
		expect(enabledGroups(buildServices({ iox }))).toEqual(["apps", "insights"]);
		expect(
			enabledGroups(buildServices({ quali: { ...quali, labId: "x" }, iox })),
		).toEqual(["lab", "apps", "insights"]);
	});
});
