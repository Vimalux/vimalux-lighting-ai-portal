import test from "node:test";
import assert from "node:assert/strict";
import {
  businessCaseCodeFromText,
  projectMatchesBusinessCaseReference,
  resolveActiveProjectIndex,
  resolveProjectByReference,
} from "./activeBusinessCaseResolver.js";

const projects = [
  {
    id: "old-local-id",
    project: { name: "Larciano", businessCaseId: "BC-111111" },
    crm: { businessCaseRecordId: "11111111-1111-4111-8111-111111111111" },
  },
  {
    id: "poggibonsi-local-id",
    project: { name: "Poggibonsi", businessCaseId: "BC-222222" },
    crm: { businessCaseRecordId: "" },
  },
];

test("SAFE RELEASE: extracts Business Case code from rendered project header", () => {
  assert.equal(businessCaseCodeFromText("Poggibonsi · BC-222222"), "BC-222222");
  assert.equal(businessCaseCodeFromText("BC-ABC-123"), "BC-ABC-123");
});

test("SAFE RELEASE: new project header wins over stale remembered Business Case", () => {
  const index = resolveActiveProjectIndex(projects, {
    urlBusinessCaseId: "",
    headerText: "Poggibonsi · BC-222222",
    storedBusinessCaseId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(index, 1);
});

test("SAFE RELEASE: explicit stable Business Case URL remains authoritative", () => {
  const index = resolveActiveProjectIndex(projects, {
    urlBusinessCaseId: "11111111-1111-4111-8111-111111111111",
    headerText: "Poggibonsi · BC-222222",
    storedBusinessCaseId: "poggibonsi-local-id",
  });
  assert.equal(index, 0);
});

test("SAFE RELEASE: stale URL reference falls back to the rendered Business Case header", () => {
  const index = resolveActiveProjectIndex(projects, {
    urlBusinessCaseId: "sbg3x34t",
    headerText: "Poggibonsi · BC-222222",
    storedBusinessCaseId: "old-local-id",
  });
  assert.equal(index, 1);
});

test("SAFE RELEASE: stale URL and absent header fall back to remembered Business Case", () => {
  const index = resolveActiveProjectIndex(projects, {
    urlBusinessCaseId: "stale-local-id",
    storedBusinessCaseId: "poggibonsi-local-id",
  });
  assert.equal(index, 1);
});

test("SAFE RELEASE: remembered Business Case is fallback only when URL and header code are absent", () => {
  const index = resolveActiveProjectIndex(projects, {
    storedBusinessCaseId: "poggibonsi-local-id",
  });
  assert.equal(index, 1);
});

test("SAFE RELEASE: shared resolver accepts UUID, local id and header-embedded code", () => {
  assert.equal(resolveProjectByReference(projects, "BC-222222")?.project?.name, "Poggibonsi");
  assert.equal(resolveProjectByReference(projects, "Poggibonsi · BC-222222")?.project?.name, "Poggibonsi");
  assert.equal(projectMatchesBusinessCaseReference(projects[0], "11111111-1111-4111-8111-111111111111"), true);
  assert.equal(projectMatchesBusinessCaseReference(projects[1], "poggibonsi-local-id"), true);
});
