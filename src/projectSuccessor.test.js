import test from "node:test";
import assert from "node:assert/strict";
import { findActiveSuccessor, preferredProject, supersededByLabel } from "./projectSuccessor.js";

const archived = {
  id:"old",
  customer:{ name:"Comune di Vicopisano" },
  project:{ name:"Vicopisano", businessCaseId:"BC-473640" },
  crm:{ status:"archived", archivedAt:"2026-10-07T10:46:55Z" },
};

const active = {
  id:"new",
  customer:{ name:"Comune di Vicopisano" },
  project:{ name:"Vicopisano", businessCaseId:"BC-FE90ABAE" },
  crm:{ status:"lead", archivedAt:"", legacyIntelligenceId:"BC-473640" },
};

test("archived predecessor resolves to its active successor", () => {
  assert.equal(findActiveSuccessor([archived, active], archived)?.id, "new");
  assert.equal(preferredProject([archived, active], archived)?.id, "new");
  assert.equal(supersededByLabel([archived, active], archived), "BC-FE90ABAE");
});

test("active Business Case remains itself", () => {
  assert.equal(preferredProject([archived, active], active)?.id, "new");
});

test("unrelated archived Business Case is not redirected", () => {
  const other = {
    ...archived,
    id:"other",
    customer:{ name:"Comune di Altro" },
    project:{ name:"Altro", businessCaseId:"BC-473640" },
  };
  assert.equal(findActiveSuccessor([other, active], other), null);
  assert.equal(preferredProject([other, active], other)?.id, "other");
});
