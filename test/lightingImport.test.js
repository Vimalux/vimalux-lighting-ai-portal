import test from "node:test";
import assert from "node:assert/strict";
import { buildImportedGroups, detectWorkbookType, guessLightingMapping, normalizeLuminaireCategory, normalizeReplacementRequirement, normalizeTechnology, parseNoleggioWorkbook, parsePlannerWorkbook } from "../src/lightingImport.js";

const emptyExtended = {
  category: "", replacementRequirement: "", operatingHours: "", lumen: "", description: "", usefulLifetime: "", kelvin: "", socket: "", installationHeight: "",
};

test("column mapping recognises common lighting headers", () => {
  assert.deepEqual(guessLightingMapping(["Asset_ID", "Street", "Lamp Type", "Wattage", "Quantity"]), { technology: "2", wattage: "3", quantity: "4", name: "1", assetId: "0", ...emptyExtended });
});

test("official VML Input Sheet semantic headers map automatically", () => {
  assert.deepEqual(
    guessLightingMapping(["Column 1", "Column 2", "Tipo lampada", "Quantità", "Column 5", "Column 6", "Potenza (W)"]),
    { technology: "2", wattage: "6", quantity: "3", name: "", assetId: "", ...emptyExtended },
  );
});

test("v2.3 Italian input template maps by header, independent of column order", () => {
  const headers = ["Localizzazione / gruppo *", "Categoria apparecchio *", "Wattaggio attuale (W) *", "Tecnologia attuale *", "N. apparecchi *", "Ore funzionamento annue *", "Modalità di sostituzione"];
  const mapping = guessLightingMapping(headers);
  assert.equal(mapping.name, "0");
  assert.equal(mapping.category, "1");
  assert.equal(mapping.wattage, "2");
  assert.equal(mapping.technology, "3");
  assert.equal(mapping.quantity, "4");
  assert.equal(mapping.operatingHours, "5");
  assert.equal(mapping.replacementRequirement, "6");
});

test("Italian dropdown labels normalise to stable internal codes", () => {
  assert.equal(normalizeLuminaireCategory("Lanterna"), "LANTERN");
  assert.equal(normalizeLuminaireCategory("Proiettore"), "FLOODLIGHT");
  assert.equal(normalizeReplacementRequirement("Sostituzione completa"), "REPLACE");
  assert.equal(normalizeReplacementRequirement("Entrambe le opzioni"), "EITHER");
});

test("technology names are normalised", () => {
  assert.equal(normalizeTechnology("Sodium HPS"), "SAP");
  assert.equal(normalizeTechnology("Metal Halide"), "MH");
  assert.equal(normalizeTechnology("Ioduri metallici / MH"), "MH");
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

test("v2.3 groups retain category, replacement strategy and operating hours", () => {
  const rows = [["Via Roma", "Lanterna", 70, "SAP", 24, 4200, "Retrofit"]];
  const mapping = guessLightingMapping(["Localizzazione / gruppo *", "Categoria apparecchio *", "Wattaggio attuale (W) *", "Tecnologia attuale *", "N. apparecchi *", "Ore funzionamento annue *", "Modalità di sostituzione"]);
  const result = buildImportedGroups(rows, mapping, [{ id: "led-1", wattage: 25, active: true }], "it");
  assert.equal(result.totalQuantity, 24);
  assert.equal(result.groups[0].existingCategory, "LANTERN");
  assert.equal(result.groups[0].replacementRequirement, "RETROFIT");
  assert.equal(result.groups[0].annualOperatingHours, 4200);
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
  assert.equal(result.contractYears,20);
  assert.equal(result.financingYears,10);
  assert.equal(result.warnings.length,0);
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

test("Ricigliano Planner workbook imports the verified 623-luminaire product mix", () => {
  const sheets = [
    { name: "PIVOT", headers: ["Row Labels","Antal af Numero Lampade","Sum of Pow W"], rows: [
      ["VML-FL01-40-730-L1-ZU",2,80],
      ["VML-MANTA-40-730-L1-ZU",442,15850],
      ["VML-MANTA-60-730-L1-ZU",58,3420],
      ["VML-OPERA-PE-40-730-ZU",18,425],
      ["VML-OPERA-PT-40-730-ZU",53,956],
      ["VML-RETRO-A-40-730-ZU",50,1110],
      ["Grand Total",623,21841]
    ] },
    { name: "Centro luminoso", headers: ["IDELEM","POTM TOT","NEW CODE","CODIFICA ARMATURE","Pow W"], rows: [
      [13500,78,"VML-MANTA-40-730-L1-ZU",1,35],
      [13501,120,"VML-MANTA-60-730-L1-ZU",1,60]
    ] }
  ];
  const products = [{id:"led-40",wattage:40,active:true},{id:"led-70",wattage:70,active:true}];
  const result = parsePlannerWorkbook(sheets,products,"AC_02_02072026_COMUNE DI RICIGLIANO RIQUALIFICAZIONE.xlsx");
  assert.equal(detectWorkbookType(sheets),"planner");
  assert.equal(result.projectName,"RICIGLIANO");
  assert.equal(result.totalQuantity,623);
  assert.equal(result.groups.length,6);
  assert.equal(result.groups.find(group => group.importedProductCode === "VML-MANTA-40-730-L1-ZU").quantity,442);
  assert.equal(result.groups.find(group => group.importedProductCode === "VML-MANTA-60-730-L1-ZU").proposedProductId,"led-70");
});

test("workbook type detection keeps Noleggio and generic imports separate", () => {
  assert.equal(detectWorkbookType([{name:"CRM_IMPORT"}]),"noleggio");
  assert.equal(detectWorkbookType([{name:"Lighting data"}]),"lighting");
});

test("Planner PIVOT import infers columns when browser headers are generic", () => {
  const sheets = [{name:"PIVOT",headers:["Column 1","Column 2","Column 3"],rows:[
    ["VML-MANTA-40-730-L1-ZU",442,15850],
    ["VML-MANTA-60-730-L1-ZU",58,3420],
    ["Hovedtotal",500,19270]
  ]}];
  const result=parsePlannerWorkbook(sheets,[{id:"led-40",wattage:40,active:true},{id:"led-70",wattage:70,active:true}],"COMUNE DI TEST RIQUALIFICAZIONE.xlsx");
  assert.equal(result.totalQuantity,500);
  assert.equal(result.groups.length,2);
});
