import test from "node:test";
import assert from "node:assert/strict";
import { buildImportedGroups, guessLightingMapping, normalizeTechnology } from "../src/lightingImport.js";

test("column mapping recognises common lighting headers", () => {
  assert.deepEqual(guessLightingMapping(["Asset_ID", "Street", "Lamp Type", "Wattage", "Quantity"]), { technology: "2", wattage: "3", quantity: "4", name: "1", assetId: "0", category: "", replacementRequirement: "", currentLuminaireModel: "", notes: "" });
});
test("grouping preserves distinct replacement characteristics",()=>{const rows=[["Via A","SAP",70,"Retrofit","AEC IBOX SMART"],["Via A","SAP",70,"Sostituzione completa","AEC IBOX SMART"]];const mapping={name:"0",technology:"1",wattage:"2",replacementRequirement:"3",currentLuminaireModel:"4",quantity:"",assetId:"",category:"",notes:""};const result=buildImportedGroups(rows,mapping,[{id:"led-1",active:true}],"it","grouped");assert.equal(result.groups.length,2)});
test("Saluzzo Via Ramello missing wattage receives audited 14 x SAP 100W",()=>{const rows=[["Via Ramello","SAP","",14,"Stradale"]];const mapping={name:"0",technology:"1",wattage:"2",quantity:"3",category:"4",assetId:"",replacementRequirement:"",currentLuminaireModel:"",notes:""};const result=buildImportedGroups(rows,mapping,[{id:"led-vimalux",active:true,wattage:31}],"it","grouped",{projectName:"Saluzzo"});const group=result.groups[0];assert.equal(result.totalQuantity,14);assert.equal(group.name,"Via Ramello – miglioria criterio H");assert.equal(group.technology,"SAP");assert.equal(group.existingWattage,100);assert.match(group.notes,/Assumption: SAP 100W baseline/)});

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
