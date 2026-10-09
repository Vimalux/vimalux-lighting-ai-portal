import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { defaultProject } from "../src/model.js";
import { buildBusinessCaseSnapshot, buildCmsPartnerCommercial } from "../src/businessCaseSync.js";
import { partnerProjectRows, partnerTotals } from "../src/partners.js";

function vicopisanoFixture() {
  const p = defaultProject({ applyStoredDefaults: false });
  p.customer.name = "Comune di Vicopisano";
  p.project.name = "Vicopisano";
  p.project.businessCaseId = "BC-FE90ABAE";
  p.groups = [{ ...p.groups[0], quantity: 1334, upgradeSelected: true, selectedForUpgrade: true }];
  p.assumptions.contractYears = 14;
  p.assumptions.serviceAgreementPeriod = 14;
  p.assumptions.opexEscalation = 2;
  p.solution.smartEnabled = true;
  p.solution.cmsEnabled = true;
  p.solution.cmsPartner = "DATEK";
  p.solution.panelEquipmentEnabled = false;
  p.solution.gatewayQuantity = 0;
  p.solution.antennaQuantity = 0;
  p.solution.meterQuantity = 0;
  const lcu = p.catalogue.smart.find(item => item.id === p.solution.lcuProductId);
  Object.assign(lcu, { cmsPartner: "DATEK", supplier: "DATEK", annualCost: 3 });
  p.pricing.overrides[lcu.id] = {
    ...(p.pricing.overrides[lcu.id] || {}),
    salesPrice: 44,
    annualSalesPrice: 4,
    implementationSalesPrice: 0,
  };
  p.crm.status = "lead";
  p.crm.closingProbability = 0;
  p.crm.expectedCloseDate = "2026-10-08";
  p.crm.nextAction = "Proposal under udarbejdelse";
  p.crm.signingDatePostponedCount = 2;
  return p;
}

test("CMS partner commercial snapshot matches CRM semantics", () => {
  const p = vicopisanoFixture();
  const commercial = buildCmsPartnerCommercial(p);
  assert.equal(commercial.partner, "DATEK");
  assert.equal(commercial.lcus, 1334);
  assert.equal(commercial.hardwareRevenue, 58696);
  assert.equal(commercial.annualRevenue, 5336);
  assert.equal(commercial.contractYears, 14);
  assert.equal(commercial.oneOffRevenue, 58696);
  assert.equal(commercial.contractValue, 133400);
});

test("Business Case snapshot publishes canonical partnerCommercial for CRM", () => {
  const p = vicopisanoFixture();
  const snapshot = buildBusinessCaseSnapshot(p, "2026-10-09T08:00:00.000Z");
  assert.equal(snapshot.datekArr, 5336);
  assert.equal(snapshot.partnerCommercial.source, "intelligence");
  assert.equal(snapshot.partnerCommercial.contractValue, 133400);
});

test("CMS partner report rows expose forecast fields without changing legacy economics", () => {
  const p = vicopisanoFixture();
  const row = partnerProjectRows([p], "DATEK", "CMS")[0];
  const totals = partnerTotals([p], "DATEK", "CMS");
  assert.equal(row.expectedSigningDate, "2026-10-08");
  assert.equal(row.nextAction, "Proposal under udarbejdelse");
  assert.equal(row.signingDatePostponedCount, 2);
  assert.equal(row.oneOffRevenue, 58696);
  assert.equal(row.partnerAnnualRevenue, 5336);
  assert.equal(row.partnerContractValue, 133400);
  assert.equal(totals.oneOffRevenue, 58696);
  assert.equal(totals.partnerAnnualRevenue, 5336);
  assert.equal(totals.partnerContractValue, 133400);
});

test("CMS PDF uses CRM-style external fields rather than weighted TCV and margin columns", () => {
  const source = fs.readFileSync(new URL("../src/partnerReport.js", import.meta.url), "utf8");
  assert.match(source, /Expected signing/);
  assert.match(source, /Products \/ quantity/);
  assert.match(source, /One-off revenue/);
  assert.match(source, /Partner TCV/);
  assert.doesNotMatch(source, /\? \[it \? "Probabilità" : "Probability", "Pipeline TCV", "Weighted TCV"\]/);
});
