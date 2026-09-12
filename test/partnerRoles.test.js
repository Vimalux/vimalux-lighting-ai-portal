import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { defaultProject, migrateProject } from "../src/model.js";
import { calculateBusinessCase } from "../src/calculations.js";
import { cmsPartnerOptions, adaptiveDimmingPartnerOptions, partnerReportOptions, partnerTotals, resolveAdaptiveDimmingPartner } from "../src/partners.js";
import { availableCmsProducts, changeCmsPartner, changeAdaptiveDimmingPartner, productRoles } from "../src/partnerRoles.js";
import { projectWithPartnerEquipmentCosts } from "../src/partnerEquipment.js";
import { groupProcurementBySupplier, procurementCsv } from "../src/procurement.js";
import { createSupplierOrderPdf } from "../src/supplierOrderPdf.js";

// Synthetic fixtures only. Commercial catalogue records/SKUs are never created by these tests.
function fixture() {
  const p = defaultProject({ applyStoredDefaults: false });
  p.solution.powerAidEnabled = true;
  p.solution.cmsPartner = "DATEK";
  p.solution.adaptiveDimmingPartner = "FELICITY";
  const lcu = p.catalogue.smart.find((item) => item.id === p.solution.lcuProductId);
  Object.assign(lcu, { partnerRole: "CMS", partnerName: "DATEK", supplier: "DATEK" });
  p.catalogue.smart.push(
    { id: "test-camera", type: "Other", name: "PowerAiD test camera", partnerRole: "ADAPTIVE_DIMMING", partnerName: "FELICITY", supplier: "FELICITY", costPrice: 1234.56, salesPrice: 2000, implementationCost: 6, implementationSalesPrice: 6, annualCost: 2, annualSalesPrice: 4 },
    { id: "test-alt-camera", type: "Other", partnerRole: "ADAPTIVE_DIMMING", partnerName: "TEST ALTERNATIVE", supplier: "TEST RESELLER" },
    { id: "test-general", type: "Other", partnerRole: "GENERAL", partnerName: "TEST GENERAL", supplier: "TEST RESELLER" },
    { id: "test-alt-lcu", type: "LCU", partnerRole: "CMS", partnerName: "TEST CMS", supplier: "TEST CMS" },
  );
  p.solution.partnerEquipment = [{ id: "camera-selection", productId: "test-camera", quantity: 2 }, { id: "general-selection", productId: "test-general", quantity: 1 }];
  return p;
}

test("CMS options respect roles and never infer FELICITY CMS from a legacy type/field", () => {
  const p = fixture();
  p.catalogue.smart.push({ id: "legacy", type: "LCU", cmsPartner: "FELICITY", supplier: "FELICITY" });
  p.solution.cmsPartner = "FELICITY";
  assert.ok(cmsPartnerOptions(p).includes("DATEK"));
  assert.ok(!cmsPartnerOptions(p).includes("FELICITY"));
  p.catalogue.smart.at(-1).partnerRole = "CMS";
  assert.ok(cmsPartnerOptions(p).includes("FELICITY"));
});
test("adaptive roles accept future suppliers without code or type changes", () => {
  const p = fixture();
  assert.ok(adaptiveDimmingPartnerOptions(p).includes("FELICITY"));
  assert.ok(adaptiveDimmingPartnerOptions(p).includes("TEST ALTERNATIVE"));
  assert.ok(!adaptiveDimmingPartnerOptions(p).includes("TEST GENERAL"));
  assert.deepEqual(productRoles({ type: "Other", supplier: "FELICITY" }), ["ADAPTIVE_DIMMING"]);
  assert.deepEqual(productRoles({ type: "Other", supplier: "TEST GENERAL" }), ["GENERAL"]);
});
test("LCU and Zhaga filtering uses role, selected partner, and explicit compatibility", () => {
  const p = fixture();
  p.catalogue.smart.push({ id: "test-compatible", type: "Zhaga", partnerRole: "CMS", partnerName: "TEST CMS", supplier: "TEST RESELLER", compatiblePartners: ["DATEK"] });
  assert.deepEqual(availableCmsProducts(p, "DATEK", "LCU").map((item) => item.id), [p.solution.lcuProductId, "test-compatible"]);
  assert.deepEqual(availableCmsProducts(p, "FELICITY", "LCU"), []);
  assert.deepEqual(availableCmsProducts(p, "", "LCU"), []);
});
test("changing CMS clears incompatible hardware only and preserves Adaptive Dimming", () => {
  const p = fixture(), before = structuredClone(p);
  const solution = changeCmsPartner(p, "TEST CMS");
  assert.equal(solution.lcuProductId, "");
  assert.deepEqual(solution.partnerEquipment, p.solution.partnerEquipment);
  assert.equal(solution.adaptiveDimmingPartner, "FELICITY");
  assert.equal(solution.powerAidEnabled, true);
  assert.equal(solution.gatewayQuantity, p.solution.gatewayQuantity);
  assert.deepEqual(p, before);
});
test("compatible LCU survives CMS change", () => {
  const p = fixture();
  p.catalogue.smart.find((item) => item.id === p.solution.lcuProductId).compatiblePartners = ["TEST CMS"];
  assert.equal(changeCmsPartner(p, "TEST CMS").lcuProductId, p.solution.lcuProductId);
});
test("changing Adaptive Dimming clears incompatible adaptive products only", () => {
  const p = fixture();
  const next = changeAdaptiveDimmingPartner(p, "TEST ALTERNATIVE");
  assert.deepEqual(next.partnerEquipment, [p.solution.partnerEquipment[1]]);
  for (const field of ["cmsPartner", "lcuProductId", "gatewayProductId", "smartEnabled", "cmsEnabled"]) assert.equal(next[field], p.solution[field]);
  p.catalogue.smart.find((item) => item.id === "test-camera").compatiblePartners = ["TEST ALTERNATIVE"];
  assert.deepEqual(changeAdaptiveDimmingPartner(p, "TEST ALTERNATIVE").partnerEquipment, p.solution.partnerEquipment);
});
test("explicit empty adaptive partner stays empty; legacy saved projects retain fallback", () => {
  const p = fixture();
  p.solution = changeAdaptiveDimmingPartner(p, "");
  assert.equal(resolveAdaptiveDimmingPartner(migrateProject(p)), "");
  delete p.solution.adaptiveDimmingPartner;
  assert.equal(resolveAdaptiveDimmingPartner(p), "FELICITY");
});
test("DATEK and FELICITY have separate dynamic reports with preserved economics", () => {
  const p = fixture(), result = calculateBusinessCase(p);
  const reports = partnerReportOptions([p]);
  assert.ok(reports.some((entry) => entry.partner === "DATEK" && entry.role === "CMS"));
  assert.ok(reports.some((entry) => entry.partner === "FELICITY" && entry.role === "ADAPTIVE_DIMMING"));
  assert.ok(!reports.some((entry) => entry.partner === "TEST ALTERNATIVE"));
  assert.equal(partnerTotals([p], "DATEK", "CMS").arr, result.cmsRevenue);
  assert.equal(partnerTotals([p], "FELICITY", "ADAPTIVE_DIMMING").arr, result.powerAidSupplierCost);
  assert.equal(partnerTotals([p], "VIMALUX").arr, result.annualRecurringRevenue);
  assert.equal(partnerTotals([p], "VIMALUX").totalContractValue, result.totalContractRevenue);
});
test("one partner can fill two roles without losing or double-counting service revenue", () => {
  const p = fixture();
  p.solution.adaptiveDimmingPartner = "DATEK";
  p.catalogue.smart.find((item) => item.id === "test-camera").partnerName = "DATEK";
  const result = calculateBusinessCase(p);
  assert.equal(partnerReportOptions([p]).filter((entry) => entry.partner === "DATEK").length, 2);
  const both = partnerTotals([p], "DATEK");
  assert.equal(both.projects, 1);
  assert.equal(both.arr, result.cmsRevenue + result.powerAidSupplierCost);
  assert.equal(both.arr, partnerTotals([p], "DATEK", "CMS").arr + partnerTotals([p], "DATEK", "ADAPTIVE_DIMMING").arr);
});
test("supplier orders use actual seller independently from role", () => {
  const p = fixture();
  const groups = groupProcurementBySupplier(p);
  assert.ok(groups.find((group) => group.supplier === "DATEK").items.some((item) => item.source === "LCU"));
  assert.equal(groups.find((group) => group.supplier === "FELICITY").items[0].quantity, 2);
  p.catalogue.smart.find((item) => item.id === "test-camera").supplier = "TEST RESELLER";
  assert.ok(groupProcurementBySupplier(p).find((group) => group.supplier === "TEST RESELLER").items.some((item) => item.productId === "test-camera"));
});
test("adaptive CAPEX and OPEX are injected exactly once, including repeated normalization", () => {
  const p = fixture(), base = structuredClone(p);
  base.solution.partnerEquipment = [];
  const result = calculateBusinessCase(p), without = calculateBusinessCase(base);
  assert.equal(result.totalCapex - without.totalCapex, 2 * 2006);
  assert.ok(Math.abs(result.capexDirectCost - without.capexDirectCost - 2 * 1240.56) < 1e-8);
  assert.equal(result.annualRecurringRevenue - without.annualRecurringRevenue, 8);
  assert.deepEqual(calculateBusinessCase(projectWithPartnerEquipmentCosts(projectWithPartnerEquipmentCosts(p))), result);
  assert.deepEqual(p.additionalCosts, base.additionalCosts);
});
test("supplier PDF contains quantity and updated product label, never internal costs", () => {
  const p = fixture();
  const group = groupProcurementBySupplier(p).find((item) => item.supplier === "FELICITY");
  const pdf = createSupplierOrderPdf(group, p, false).output();
  assert.match(pdf, /Adaptive Dimming test camera/);
  assert.doesNotMatch(pdf, /PowerAiD|Unit cost|Total cost|1234\.56|1240\.56|2481\.12/);
  assert.match(pdf, /Qty/);
  assert.doesNotMatch(procurementCsv(group,p), /Unit cost|Total cost|1240\.56|2481\.12/);
});
test("VIMALUX regression retains all 620 annual revenue and full CAPEX plus contract services", () => {
  const p = defaultProject({ applyStoredDefaults: false });
  p.additionalCosts = [{ id: "poles", costType: "capex", quantity: 20, unitCost: 100, unitSalesPrice: 120 }, { id: "service", costType: "opex_annual", quantity: 20, unitCost: 4, unitSalesPrice: 6 }];
  assert.ok(cmsPartnerOptions(p).includes("VIMALUX"));
  const row = partnerTotals([p], "VIMALUX");
  assert.equal(row.arr, 620);
  assert.equal(row.totalContractValue, 30788.82701983747);
});
test("workflows validate source without write permissions, branch checkout, or source patching", () => {
  const directory = new URL("../.github/workflows/", import.meta.url);
  const names = fs.readdirSync(directory);
  assert.deepEqual(names, ["staging-validation.yml"]);
  const workflow = fs.readFileSync(new URL(names[0], directory), "utf8");
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /git diff --exit-code HEAD/);
  assert.doesNotMatch(workflow, /contents: write|git push|git commit|ref:|python|patch.*\.cjs/);
});
test("Hybrid Lighting and General reports allocate a selected item to one role only", () => {
  const p = fixture();
  Object.assign(p.catalogue.smart.find((item) => item.id === "test-general"), { partnerRoles: ["HYBRID_LIGHTING", "GENERAL"], partnerRole: "", costPrice: 100 });
  const entries = partnerReportOptions([p]).filter((entry) => entry.partner === "TEST GENERAL");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].role, "HYBRID_LIGHTING");
  assert.equal(partnerTotals([p], "TEST GENERAL").totalContractValue, 100);
});
test("display copy uses Adaptive Dimming while retaining persisted internal fields", () => {
  for (const file of ["App.jsx", "CrmOpportunity.jsx", "HybridSummary.jsx", "report.js", "preliminaryProposal.js", "preliminaryProposalV2.js", "i18n.js", "partnerReport.js"]) {
    const source = fs.readFileSync(new URL("../src/"+file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /PowerAiD|CMS Partners/, file);
  }
  const p = migrateProject(fixture());
  assert.equal(p.solution.powerAidEnabled, true);
  assert.equal(p.solution.cmsPartner, "DATEK");
  assert.equal(p.solution.adaptiveDimmingPartner, "FELICITY");
});
test("Intelligence still withholds delete callbacks and controls from agents", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /remove=\{isAgent \? undefined : removeProject\}/);
  assert.match(source, /\{remove && <button className="danger project-delete"/);
  assert.match(source, /if \(isReadOnlyAgentProject\) return all;/);
  assert.match(source, /if \(isAgent && path\[0\] === "pricing"\) return all;/);
});
