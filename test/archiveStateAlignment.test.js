import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const transport=fs.readFileSync(new URL("../src/businessCaseTransport.js",import.meta.url),"utf8");

test("Intelligence excludes archived/lost cases from active forecasts",()=>{
  assert.match(app,/const isArchivedProject/);
  assert.match(app,/activeSyncedProjects/);
  assert.match(app,/CmsPartnerDashboard projects=\{activeSyncedProjects\}/);
  assert.match(app,/PartnerReports projects=\{activeSyncedProjects\}/);
});

test("Intelligence keeps archived/lost cases as read-only history",()=>{
  assert.match(app,/Tabte \/ arkiverede/);
  assert.match(app,/read-only history/);
  assert.match(app,/if \(isArchivedProject\(currentProject\)\) return all/);
  assert.match(transport,/archiveReason:/);
  assert.match(transport,/archivedAt:/);
});
