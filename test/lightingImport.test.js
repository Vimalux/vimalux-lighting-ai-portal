import test from "node:test";
import assert from "node:assert/strict";
import { buildImportedGroups, guessLightingMapping, normalizeTechnology, parseNoleggioWorkbook } from "../src/lightingImport.js";

test("column mapping recognises common lighting headers", () => {
  assert.deepEqual(guessLightingMapping(["Asset_ID", "Street", "Lamp Type", "Wattage", "Quantity"]), { technology: "2", wattage: "3", quantity: "4", name: "1", assetId: "0" });
});

test("technology names are normalised", () => {
  assert.equal(normalizeTechnology("Sodium HPS"), "SAP");
  assert.equal(normalizeTechnology("Metal Halide"), "MH");
  assert.equal(normalizeTechnology("HQL Mercury"), "MERCURY");
  assert.equal(normalizeTechnology("Existing LED"), "LED");
});

test("individual rows aggregate into wattage and technology groups", () => {
  const rows = [["HPS", 70], ["SAP", 70], ["HQL", 125], ["HQL", 0]];
  const result = buildImportedGroups(rows, { technology: "0", wattage: "1", quantity: "", name: "" }, [{ id: "led-1", active: true }], "en");
  assert.equal(result.totalQuantity, 3);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups.find((group) => group.technology === "SAP").quantity, 2);
  assert.equal(result.skipped, 1);
});

test("an optional quantity column imports already summarised sheets", () => {
  const result = buildImportedGroups([["LED", "100", "357"]], { technology: "0", wattage: "1", quantity: "2", name: "" }, [{ id: "led-1", active: true }], "en");
  assert.equal(result.totalQuantity, 357);
});

test("individual mode keeps every luminaire as its own row", () => {
  const rows = [["A-1", "Main Street", "HPS", 70], ["A-2", "Main Street", "HPS", 70]];
  const result = buildImportedGroups(rows, { assetId: "0", name: "1", technology: "2", wattage: "3", quantity: "" }, [{ id: "led-1", active: true }], "en", "individual");
  assert.equal(result.groups.length, 2);
  assert.deepEqual(result.groups.map((group) => group.name), ["A-1", "A-2"]);
  assert.ok(result.groups.every((group) => group.quantity === 1));
});

test("individual mode expands a summarised quantity into separate rows", () => {
  const result = buildImportedGroups([["Main Street", "HPS", 70, 3]], { assetId: "", name: "0", technology: "1", wattage: "2", quantity: "3" }, [{ id: "led-1", active: true }], "en", "individual");
  assert.equal(result.groups.length, 3);
  assert.ok(result.groups.every((group) => group.quantity === 1));
});

test("Noleggio CRM_IMPORT fallback maps official commercial values and warns on period mismatch", () => {
  const sheets = [{ name: "CRM_IMPORT", headers: ["Field","Value","Source","Notes"], rows: [
    ["project_name","Comune di Larciano"],["customer_name","Comune di Larciano"],["lamps",1182],
    ["capex",388248],["contract_years",20],["financing_years",10],["total_opex_annual",32022],
    ["customer_cost_financed_annual",60653.88],["customer_cost_cash_annual",92675.88]
  ] }];
  const result = parseNoleggioWorkbook(sheets);
  assert.equal(result.capex,388248);
  assert.equal(result.allInclusiveAnnualPayment,92675.88);
  assert.equal(result.contractYears,10);
  assert.equal(result.warnings.length,1);
});


test("Larciano import validates stale CRM cache against the visible customer offer", () => {
  const sheets = [
    { name: "CRM_IMPORT", headers: ["Field","Value","Source","Notes"], rows: [
      ["project_name","Comune di Larciano"],["customer_name","Comune di Larciano"],["quotation_id","21-5-2026_Comune di Larciano"],
      ["lamps",1254],["capex",484848],["contract_years",20],["financing_years",10],
      ["maintenance_opex_annual",17730],["cms_connectivity_annual",7524],["saas_poweraid_annual",7200],
      ["total_opex_annual",32454],["customer_cost_financed_annual",80033.89667785246],
      ["customer_cost_cash_annual",113207.89667785246]
    ] },
    { name: "Dashboard", headers: ["INPUT CELLS"], rows: [
      ["**Contract period in years",9],["Finance / years (is=0;cash)",9],["Interest rate for customer",0.094]
    ] },
    { name: "QuotationCustomer_ITA", headers: ["Offerta"], rows: [
      ["Totale pagamenti per il progetto",null,null,-1018871.0701006723]
    ] }
  ];
  const result = parseNoleggioWorkbook(sheets);
  assert.equal(result.lamps,1254);
  assert.equal(result.capex,484848);
  assert.equal(result.contractYears,9);
  assert.equal(result.financingYears,9);
  assert.equal(result.interestRate,9.4);
  assert.equal(result.annualOpex,32454);
  assert.equal(result.allInclusiveAnnualPayment,113207.9);
  assert.equal(result.totalCustomerPayments,1018871.07);
  assert.equal(result.warnings.length,2);
});
