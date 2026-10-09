import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../src/partnerReport.js",import.meta.url),"utf8");

test("CMS partner PDF includes report date and language-consistent Italian labels",()=>{
  assert.match(source,/Data report/);
  assert.match(source,/Report date/);
  assert.match(source,/it \? "Fase" : "Stage"/);
  assert.match(source,/it \? "TCV partner" : "Partner TCV"/);
});
