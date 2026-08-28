import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject, storedMasterCatalogue } from "../src/model.js";

test("new projects inherit the richest synced product catalogue", () => {
  const catalogue = {
    led: [
      { id: "manta-20", brand: "VML", name: "MANTA-20W", wattage: 20, active: true },
      { id: "manta-40", brand: "VML", name: "MANTA-40W", wattage: 40, active: true },
      { id: "opera-25", brand: "VML", name: "OPERA-25W", wattage: 25, active: true },
    ],
    smart: [{ id: "lcu-one", brand: "VML", name: "LCU One", active: true }],
  };
  const stored = [
    { id: "old", catalogue: { led: [{ id: "led-40" }, { id: "led-70" }], smart: [] } },
    { id: "master", catalogue },
  ];
  globalThis.localStorage = {
    getItem(key) { return key === "vimalux-intelligence-projects" ? JSON.stringify(stored) : null; },
  };
  try {
    assert.equal(storedMasterCatalogue().led.length, 3);
    const project = defaultProject();
    assert.deepEqual(project.catalogue.led.map((item) => item.id), ["manta-20", "manta-40", "opera-25"]);
    project.catalogue.led[0].name = "changed";
    assert.equal(stored[1].catalogue.led[0].name, "MANTA-20W");
  } finally {
    delete globalThis.localStorage;
  }
});
