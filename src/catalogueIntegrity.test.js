import test from "node:test";
import assert from "node:assert/strict";
import { catalogueForMasterSave, catalogueWithHistoricalSelections } from "./catalogueIntegrity.js";

test("uses the current master catalogue for new selections while preserving a selected historical product", () => {
  const project = {
    groups: [{ proposedProductId: "old-40" }],
    catalogue: {
      led: [
        { id: "old-40", name: "Old 40W", active: true },
        { id: "current-55", name: "Current 55W", active: true },
      ],
    },
  };
  const master = { led: [{ id: "current-55", name: "Current 55W", active: true }], smart: [] };

  const merged = catalogueWithHistoricalSelections(project, master);

  assert.equal(merged.led.find((item) => item.id === "current-55")?.active, true);
  assert.deepEqual(
    Object.fromEntries(Object.entries(merged.led.find((item) => item.id === "old-40")).filter(([key]) => ["active", "historicalOnly"].includes(key))),
    { active: false, historicalOnly: true },
  );
});

test("does not retain deleted products that are not selected historically", () => {
  const project = {
    groups: [{ proposedProductId: "current-55" }],
    catalogue: { led: [{ id: "old-40", active: true }, { id: "current-55", active: true }] },
  };
  const master = { led: [{ id: "current-55", active: true }], smart: [] };

  const merged = catalogueWithHistoricalSelections(project, master);

  assert.deepEqual(merged.led.map((item) => item.id), ["current-55"]);
});

test("never writes historical-only products back into the master catalogue", () => {
  const saved = catalogueForMasterSave({
    led: [
      { id: "current-55", active: true },
      { id: "old-40", active: false, historicalOnly: true },
    ],
    smart: [{ id: "lcu-1" }],
  });

  assert.deepEqual(saved.led.map((item) => item.id), ["current-55"]);
  assert.deepEqual(saved.smart, [{ id: "lcu-1" }]);
});
