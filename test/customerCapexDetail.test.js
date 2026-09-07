import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerCapexDetail } from "../src/customerCapexDetail.js";

test("customer CAPEX detail exposes product sales lines and reconciles without internal costs", () => {
  const project = {
    solution: {
      lcuProductId: "lcu",
      gatewayProductId: "gateway",
      gatewayQuantity: 2,
      antennaProductId: "antenna",
      antennaQuantity: 2,
      meterProductId: "meter",
      meterQuantity: 2,
    },
    catalogue: {
      smart: [
        { id: "lcu", brand: "VIMALUX", name: "LCU One", costPrice: 1 },
        { id: "gateway", brand: "VIMALUX", name: "Gateway", costPrice: 2 },
        { id: "antenna", brand: "VIMALUX", name: "Antenna", costPrice: 3 },
        { id: "meter", brand: "VIMALUX", name: "Energy Meter", costPrice: 4 },
      ],
    },
    additionalCosts: [
      { costType: "capex", description: "Camera sensor", quantity: 2, unit: "pz", unitSalesPrice: 2000, unitCost: 10 },
      { costType: "opex_annual", description: "Annual support", quantity: 1, unit: "yr", unitSalesPrice: 100 },
    ],
  };

  const calculated = {
    groupRows: [
      { upgradeSelected: true, quantity: 80, configuredLedWattage: 40, salesTotal: 7600, product: { id: "manta40", brand: "VIMALUX", name: "MANTA 40", hybrid: false, costPrice: 20 } },
      { upgradeSelected: true, quantity: 12, configuredLedWattage: 30, salesTotal: 2880, product: { id: "enby30", brand: "VIMALUX", name: "ENBY-S-30", hybrid: true, costPrice: 30 } },
      { upgradeSelected: true, quantity: 24, configuredLedWattage: 40, salesTotal: 5760, product: { id: "enby40", brand: "VIMALUX", name: "ENBY-S-40", hybrid: true, costPrice: 30 } },
      { upgradeSelected: true, quantity: 46, configuredLedWattage: 60, salesTotal: 11040, product: { id: "enby60", brand: "VIMALUX", name: "ENBY-S-60", hybrid: true, costPrice: 30 } },
    ],
    lcuQuantity: 162,
    smartHardwareCapex: 7776,
    implementationCapex: 972,
    gatewayCapex: 1100,
    antennaCapex: 208,
    meterCapex: 730,
    freight: 3558,
    totalCapex: 46636,
  };

  const detail = buildCustomerCapexDetail(project, calculated);
  assert.equal(detail.luminaires.length, 4);
  assert.equal(detail.totalLuminaireQuantity, 162);
  assert.equal(detail.hybridLuminaireQuantity, 82);
  assert.equal(detail.luminaireSubtotal, 27280);
  assert.equal(detail.reconciles, true);
  assert.equal(detail.reconciledTotal, 46636);
  assert.equal(detail.components.some((row) => row.name === "Camera sensor" && row.total === 4000), true);
  assert.equal(detail.components.some((row) => row.name.includes("Annual support")), false);
  assert.equal(JSON.stringify(detail).includes("costPrice"), false);
  assert.equal(JSON.stringify(detail).includes("unitCost"), false);
});

test("official CAPEX differences are shown as explicit commercial adjustment", () => {
  const project = { solution: {}, catalogue: { smart: [] }, additionalCosts: [] };
  const calculated = {
    groupRows: [{ upgradeSelected: true, quantity: 10, configuredLedWattage: 40, salesTotal: 1000, product: { id: "lamp", name: "Lamp 40", hybrid: false } }],
    totalCapex: 950,
  };
  const detail = buildCustomerCapexDetail(project, calculated);
  const adjustment = detail.components.find((row) => row.category === "adjustment");
  assert.equal(adjustment.total, -50);
  assert.match(adjustment.name, /sconto/i);
  assert.equal(detail.reconciles, true);
  assert.equal(detail.reconciledTotal, 950);
});
