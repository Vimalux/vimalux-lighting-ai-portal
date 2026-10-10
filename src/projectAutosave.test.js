import test from "node:test";
import assert from "node:assert/strict";
import { changedProjects } from "./projectAutosave.js";

test("autosave selects only changed project object references", () => {
  const a = { id:"a", updatedAt:"1" };
  const b = { id:"b", updatedAt:"1" };
  const nextA = { ...a, updatedAt:"2" };
  assert.deepEqual(changedProjects([a,b],[nextA,b]), [nextA]);
});

test("autosave includes new projects and ignores unchanged portfolio rows", () => {
  const a = { id:"a" };
  const b = { id:"b" };
  const c = { id:"c" };
  assert.deepEqual(changedProjects([a,b],[a,b,c]), [c]);
});

test("autosave treats a promoted id as a changed project", () => {
  const local = { id:"local-1" };
  const promoted = { ...local, id:"11111111-1111-4111-8111-111111111111" };
  assert.deepEqual(changedProjects([local],[promoted]), [promoted]);
});
