import test from "node:test";
import assert from "node:assert/strict";
import { dedupeProjects } from "../src/projectDeduplication.js";

const masterId = "24979dc1-125f-4694-9203-6edf101e5864";

test("duplicate local rows with the same Business Case code collapse to one project", () => {
  const imported = {
    id: "local-import-copy",
    project: { name: "Vicopisano", businessCaseId: "BC-FE90ABAE" },
    customer: { name: "Comune di Vicopisano" },
    importedTechnical: { fileName: "Vicopisano_Censimento_VIMALUX.xlsx" },
    crm: {},
  };
  const stale = {
    id: "another-local-copy",
    project: { name: "Vicopisano", businessCaseId: "BC-FE90ABAE" },
    customer: { name: "Comune di Vicopisano" },
    crm: {},
  };
  assert.deepEqual(dedupeProjects([imported, stale]), [imported]);
});

test("stable Business Case record identity collapses stale browser copies even when local ids differ", () => {
  const cloud = {
    id: masterId,
    project: { name: "Vicopisano", businessCaseId: "BC-473640" },
    customer: { name: "Comune di Vicopisano" },
    crm: { businessCaseRecordId: masterId },
  };
  const stale = {
    id: "BC-473640",
    project: { name: "Vicopisano", businessCaseId: "BC-473640" },
    customer: { name: "Comune di Vicopisano" },
    crm: { businessCaseRecordId: masterId },
  };
  assert.deepEqual(dedupeProjects([cloud, stale]), [cloud]);
});
