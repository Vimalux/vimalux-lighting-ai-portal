import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, "App.jsx"), "utf8");
const cardSource = fs.readFileSync(path.join(here, "AdditionalCostsCard.jsx"), "utf8");

test("agent workflow permanently includes project additional costs between solution and assumptions", () => {
  assert.match(
    appSource,
    /const agentWorkflow = \[[\s\S]*workflow\.slice\(0, 3\)[\s\S]*\["additionalCosts", "additionalCosts"\][\s\S]*\["assumptions", "assumptions"\]/,
  );
});

test("agent additional-cost view is rendered with agent mode and remains outside internal pricing", () => {
  assert.match(
    appSource,
    /isAgent && view === "additionalCosts" && <AdditionalCostsCard p=\{project\} update=\{update\} mode="agent" \/>/,
  );
  assert.match(appSource, /!isAgent && view === "pricing"/);
});

test("agent additional-cost card keeps add action while hiding internal unit cost", () => {
  assert.match(cardSource, /showInternalCosts = mode !== "agent"/);
  assert.match(cardSource, /\+ Aggiungi costo/);
  assert.match(cardSource, /replaceRows\(\[\.\.\.rows, emptyRow\(\)\]\)/);
});

test("agent update path is explicitly accepted and sanitized", () => {
  assert.match(
    appSource,
    /if \(isAgent && path\[0\] === "additionalCosts"\) \{[\s\S]*sanitizeAgentAdditionalCosts\(project\.additionalCosts, value\)/,
  );
});
