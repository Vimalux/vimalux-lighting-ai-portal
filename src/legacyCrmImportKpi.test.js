import test from "node:test";
import assert from "node:assert/strict";
import { parseNoleggioWorkbook } from "./lightingImport.js";
import { buildBusinessCaseSnapshot } from "./businessCaseSync.js";
import { defaultProject } from "./model.js";

const crmImportSheet = {
  name: "CRM_IMPORT",
  headers: ["Field", "Value", "Source", "Notes"],
  rows: [
    ["project_name", "Comune di Larciano", "", ""],
    ["customer_name", "Comune di Larciano", "", ""],
    ["quotation_id", "Comune di Larciano", "", ""],
    ["existing_luminaires", 1254, "", ""],
    ["upgrade_luminaires", 1182, "", ""],
    ["smart_connected_luminaires", 1182, "", ""],
    ["upgrade_coverage_pct", 1182 / 1254, "", ""],
    ["tcv", 388248, "", ""],
    ["contract_years", 20, "", ""],
    ["financing_years", 10, "", ""],
    ["total_opex_annual", 32022, "", ""],
    ["annual_contract_revenue", 92675.88021047623, "", ""],
    ["annual_energy_cost_before", 181788.936, "", ""],
    ["annual_energy_cost_after", 57830.234, "", ""],
    ["annual_energy_saving_eur", 151701.261152, "", ""],
    ["energy_reduction_pct", 0.8308131918181083, "", ""],
    ["co2_reduction_tons", 525.7551978, "", ""],
    ["payback_years", 3.1609100637, "", ""],
  ],
};

test("standard CRM_IMPORT fields map to the shared KPI dictionary without requiring legacy capex", () => {
  const imported = parseNoleggioWorkbook([crmImportSheet]);
  assert.equal(imported.mappingVersion, 3);
  assert.equal(imported.lamps, 1182);
  assert.equal(imported.standardKpis.existingLuminaires, 1254);
  assert.equal(imported.standardKpis.upgradeLuminaires, 1182);
  assert.equal(imported.standardKpis.smartConnectedLuminaires, 1182);
  assert.ok(Math.abs(imported.standardKpis.upgradeCoveragePct - 94.2583732057) < 0.001);
  assert.equal(imported.standardKpis.tcv, 388248);
  assert.equal(imported.standardKpis.annualContractRevenue, 92675.88021047623);
  assert.ok(Math.abs(imported.standardKpis.energyReductionPct - 83.0813191818) < 0.001);
  assert.equal(imported.standardKpis.co2ReductionTons, 525.7551978);
});

test("legacy Excel shared KPIs override calculated CRM snapshot fields only when supplied", () => {
  const project = defaultProject();
  project.importedCommercial = {
    standardKpis: {
      existingLuminaires: 1254,
      upgradeLuminaires: 1182,
      smartConnectedLuminaires: 1182,
      upgradeCoveragePct: 94.2583732057,
      tcv: 388248,
      annualContractRevenue: 92675.88,
      annualEnergyCostBefore: 181788.94,
      annualEnergyCostAfter: 57830.23,
      annualEnergySavingEUR: 151701.26,
      energyReductionPct: 83.0813,
      co2ReductionTons: 525.7552,
      paybackYears: 3.1609,
    },
  };
  const snapshot = buildBusinessCaseSnapshot(project, "2026-08-22T08:00:00.000Z");
  assert.equal(snapshot.source, "VIMALUX Legacy Excel CRM_IMPORT");
  assert.equal(snapshot.sourceStatus, "calculated");
  assert.equal(snapshot.existingLuminaires, 1254);
  assert.equal(snapshot.upgradeLuminaires, 1182);
  assert.equal(snapshot.tcv, 388248);
  assert.equal(snapshot.annualCustomerPayment, 92675.88);
  assert.equal(snapshot.monthlyCustomerPayment, 92675.88 / 12);
  assert.ok(snapshot.capex > 0, "missing imported CAPEX falls back to calculated CAPEX rather than being replaced with TCV");
});
