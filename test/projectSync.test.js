import test from "node:test";
import assert from "node:assert/strict";
import { mergeProjectStates } from "../src/projectSync.js";

test("cloud and local project lists are merged without losing local-only projects", () => {
  const local = [{ id: "san-fele", updatedAt: "2026-07-01T10:00:00Z" }];
  const cloud = [{ id: "saluzzo", updatedAt: "2026-08-01T10:00:00Z" }];
  assert.deepEqual(mergeProjectStates(local, cloud).map((project) => project.id).sort(), ["saluzzo", "san-fele"]);
});

test("newest project version wins when local and cloud IDs match", () => {
  const local = [{ id: "same", updatedAt: "2026-08-02T10:00:00Z", project: { name: "Local newest" } }];
  const cloud = [{ id: "same", updatedAt: "2026-08-01T10:00:00Z", project: { name: "Cloud older" } }];
  assert.equal(mergeProjectStates(local, cloud)[0].project.name, "Local newest");
  assert.equal(mergeProjectStates(cloud, local)[0].project.name, "Local newest");
});

test("cloud wins a tie to avoid overwriting server data with an ambiguous local copy", () => {
  const local = [{ id: "same", project: { name: "Local" } }];
  const cloud = [{ id: "same", project: { name: "Cloud" } }];
  assert.equal(mergeProjectStates(local, cloud)[0].project.name, "Cloud");
});
test("Intelligence technical data and CRM-specific data keep separate sources of truth",()=>{const intelligence={id:"saluzzo",updatedAt:"2026-08-03T10:00:00Z",groups:[{quantity:371}],crm:{status:"lead"},crmUpdatedAt:"2026-08-01T10:00:00Z"};const crm={id:"saluzzo",updatedAt:"2026-08-02T10:00:00Z",groups:[{quantity:443,name:"86 da classificare"}],crm:{status:"proposal",closingProbability:60},crmUpdatedAt:"2026-08-04T10:00:00Z"};const merged=mergeProjectStates([intelligence],[crm])[0];assert.equal(merged.groups[0].quantity,371);assert.equal(merged.crm.status,"proposal");assert.equal(merged.crm.closingProbability,60)});
