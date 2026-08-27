import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const app = fs.readFileSync("src/App.jsx", "utf8");
const transport = fs.readFileSync("src/businessCaseTransport.js", "utf8");
test("luminaire category is editable and persisted", () => { assert.match(app, /Tipo apparecchio/); assert.match(app, /luminaireCategory: category, existingCategory: category/); assert.match(app, /compatibleExistingCategories/); });
test("shared agent project remains read only", () => { assert.match(app, /disabled=\{readOnly\}/); assert.match(app, /if \(isReadOnlyAgentProject\) return all/); assert.match(transport, /agentAccessMode: crm\.agent_access_mode/); });
