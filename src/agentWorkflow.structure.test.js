import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, "App.jsx"), "utf8");
const cardSource = fs.readFileSync(path.join(here, "AdditionalCostsCard.jsx"), "utf8");

test("shared workflow includes project additional costs before pricing and assumptions", () => {
  assert.match(
    appSource,
    /const workflow = \[[\s\S]*\["solution", "solution"\][\s\S]*\["additionalCosts", "additionalCosts"\][\s\S]*\["pricing", "pricing"\][\s\S]*\["assumptions", "assumptions"\]/,
  );
  assert.match(appSource, /const agentWorkflow = workflow\.filter\(\(\[id\]\) => id !== "pricing"\);/);
});

test("additional-cost view is shared while internal pricing remains admin-only", () => {
  assert.match(
    appSource,
    /view === "additionalCosts" && <AdditionalCostsCard p=\{project\} update=\{update\} mode=\{isAgent \? "agent" : "admin"\} \/>/,
  );
  assert.match(appSource, /!isAgent && view === "pricing"/);
});

test("additional costs are no longer embedded inside admin assumptions", () => {
  assert.doesNotMatch(appSource, /<VatSettings p=\{p\} r=\{r\} update=\{update\} \/><AdditionalCostsCard p=\{p\} update=\{update\} \/>/);
});

test("agent additional-cost card accepts supplier cost and shows calculated project price", () => {
  assert.match(cardSource, /const isAgent = mode === "agent"/);
  assert.match(cardSource, /showInternalCosts = !isAgent/);
  assert.match(cardSource, /"Costo unitario"/);
  assert.match(cardSource, /"Prezzo progetto"/);
  assert.match(cardSource, /change\(index, "unitCost"/);
  assert.match(cardSource, /formatter\.format\(row\.unitSalesPrice \|\| 0\)/);
  assert.match(cardSource, /\+ Aggiungi costo/);
});

test("agent update path is explicitly accepted and sanitized", () => {
  assert.match(
    appSource,
    /if \(isAgent && path\[0\] === "additionalCosts"\) \{[\s\S]*sanitizeAgentAdditionalCosts\(project\.additionalCosts, value\)/,
  );
});
