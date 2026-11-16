import test from "node:test";
import assert from "node:assert/strict";
import { isAgentRuntime, readRuntimeProjects, setRuntimeProjectSnapshot, writeRuntimeProjects } from "./runtimeProjectStore.js";

test("agent project state never accesses persistent browser storage", () => {
  let touches = 0;
  global.localStorage = {
    getItem: () => { touches++; throw new Error("agent must not read local storage"); },
    setItem: () => { touches++; throw new Error("agent must not write local storage"); },
  };
  setRuntimeProjectSnapshot([{ id: "cloud-1" }], { agent: true });
  assert.equal(isAgentRuntime(), true);
  assert.equal(readRuntimeProjects()[0].id, "cloud-1");
  writeRuntimeProjects([{ id: "cloud-2" }]);
  assert.equal(readRuntimeProjects()[0].id, "cloud-2");
  assert.equal(touches, 0);
  setRuntimeProjectSnapshot([], { agent: false });
});
