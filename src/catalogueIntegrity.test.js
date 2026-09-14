import { describe, expect, it } from "vitest";
import { catalogueForMasterSave, catalogueWithHistoricalSelections } from "./catalogueIntegrity.js";

describe("catalogue integrity", () => {
  it("uses the current master catalogue for new selections", () => {
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

    expect(merged.led.find((item) => item.id === "current-55")?.active).toBe(true);
    expect(merged.led.find((item) => item.id === "old-40")).toMatchObject({ active: false, historicalOnly: true });
  });

  it("does not retain deleted products that are not selected historically", () => {
    const project = {
      groups: [{ proposedProductId: "current-55" }],
      catalogue: { led: [{ id: "old-40", active: true }, { id: "current-55", active: true }] },
    };
    const master = { led: [{ id: "current-55", active: true }], smart: [] };

    const merged = catalogueWithHistoricalSelections(project, master);

    expect(merged.led.map((item) => item.id)).toEqual(["current-55"]);
  });

  it("never writes historical-only products back into the master catalogue", () => {
    const saved = catalogueForMasterSave({
      led: [
        { id: "current-55", active: true },
        { id: "old-40", active: false, historicalOnly: true },
      ],
      smart: [{ id: "lcu-1" }],
    });

    expect(saved.led.map((item) => item.id)).toEqual(["current-55"]);
    expect(saved.smart).toEqual([{ id: "lcu-1" }]);
  });
});
