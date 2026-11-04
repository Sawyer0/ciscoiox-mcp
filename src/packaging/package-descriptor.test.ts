import { describe, expect, it } from "vitest";
import { PackageError } from "../domain/errors";
import { parseDescriptor } from "./package-descriptor";

const valid = `
descriptor-schema-version: 2.2
info:
  name: iox_docker_python
  version: 1.0
app:
  cpuarch: x86_64
  type: docker
  resources:
    profile: custom
    cpu: "200"
    memory: 64
    disk: 2
  startup:
    rootfs: rootfs.tar
    target: ["python", "main.py"]
`;

describe("parseDescriptor", () => {
	it("extracts the fields used for deployment and quota checks", () => {
		expect(parseDescriptor(valid)).toEqual({
			schemaVersion: "2.2",
			name: "iox_docker_python",
			version: "1",
			appType: "docker",
			cpuarch: "x86_64",
			resources: { profile: "custom", cpu: 200, memory: 64, disk: 2 },
			rootfs: "rootfs.tar",
		});
	});

	it("lists every missing required field", () => {
		expect(() => parseDescriptor("info: {}\n")).toThrow(
			/descriptor-schema-version: .*; info\.name: .*; app: /,
		);
	});

	it("rejects malformed YAML", () => {
		expect(() => parseDescriptor("info: [unclosed")).toThrow(PackageError);
	});
});
