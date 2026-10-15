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

test("distinct stable Business Cases with the same customer and project name are preserved", () => {
  const first = {
    id: "11111111-1111-4111-8111-111111111111",
    project: { name: "Lajatico", businessCaseId: "BC-A" },
    customer: { name: "Comune di Lajatico" },
    importedTechnical: { fileName: "Lajatico.xlsx" },
    crm: { businessCaseRecordId: "11111111-1111-4111-8111-111111111111" },
  };
  const second = {
    id: "22222222-2222-4222-8222-222222222222",
    project: { name: "Lajatico", businessCaseId: "BC-B" },
    customer: { name: "Comune di Lajatico" },
    importedTechnical: { fileName: "Lajatico.xlsx" },
    crm: { businessCaseRecordId: "22222222-2222-4222-8222-222222222222" },
  };

  assert.deepEqual(dedupeProjects([first, second]), [first, second]);
});

test("normal cloud hydration does not discard a new local draft only because its name matches a cloud project", () => {
  const cloud = {
    id: masterId,
    project: { name: "San Fele", businessCaseId: "BC-OLD" },
    customer: { name: "Comune di San Fele" },
    crm: { businessCaseRecordId: masterId },
  };
  const newDraft = {
    id: "local-new-san-fele",
    project: { name: "San Fele", businessCaseId: "BC-NEW" },
    customer: { name: "Comune di San Fele" },
    crm: {},
  };

  assert.deepEqual(dedupeProjects([cloud, newDraft]), [cloud, newDraft]);
});

test("explicit re-import may reconcile matching local/import identity without affecting normal selection", () => {
  const cloud = {
    id: masterId,
    project: { name: "Vicopisano", businessCaseId: "BC-CLOUD" },
    customer: { name: "Comune di Vicopisano" },
    importedTechnical: { fileName: "Vicopisano_Censimento_VIMALUX.xlsx" },
    crm: { businessCaseRecordId: masterId },
  };
  const localCopy = {
    id: "local-import-copy",
    project: { name: "Vicopisano", businessCaseId: "BC-LOCAL" },
    customer: { name: "Comune di Vicopisano" },
    importedTechnical: { fileName: "Vicopisano_Censimento_VIMALUX.xlsx" },
    crm: {},
  };

  assert.deepEqual(
    dedupeProjects([cloud, localCopy], { dedupeImportIdentity: true }),
    [cloud],
  );
});
