import assert from "node:assert/strict";
import test from "node:test";
import { setRuntimeProjectSnapshot } from "./runtimeProjectStore.js";
import { clearRuntimeImportTarget, readRuntimeImportTarget, setRuntimeImportTarget } from "./runtimeImportTarget.js";

test("agent import target stays in memory and never uses browser storage", () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() { throw new Error("agent must not read localStorage"); },
    setItem() { throw new Error("agent must not write localStorage"); },
    removeItem() { throw new Error("agent must not erase localStorage"); },
  };
  try {
    setRuntimeProjectSnapshot([], { agent: true });
    setRuntimeImportTarget("BC-agent-123");
    assert.equal(readRuntimeImportTarget(), "BC-agent-123");
    clearRuntimeImportTarget();
    assert.equal(readRuntimeImportTarget(), "");
  } finally {
    setRuntimeProjectSnapshot([], { agent: false });
    globalThis.localStorage = previous;
  }
});
