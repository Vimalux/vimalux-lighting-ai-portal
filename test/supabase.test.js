import test from "node:test";
import assert from "node:assert/strict";
import { deleteProjectRow } from "../src/cloudProjects.js";

function clientWith({ deleteError = null, remaining = null, verifyError = null } = {}) {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return {
        delete() {
          calls.push(["delete"]);
          return {
            async eq(column, value) {
              calls.push(["delete.eq", column, value]);
              return { error: deleteError };
            },
          };
        },
        select(columns) {
          calls.push(["select", columns]);
          return {
            eq(column, value) {
              calls.push(["select.eq", column, value]);
              return {
                async maybeSingle() {
                  calls.push(["maybeSingle"]);
                  return { data: remaining, error: verifyError };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test("cloud deletion removes the selected project and verifies it is gone", async () => {
  const { client, calls } = clientWith();
  await deleteProjectRow(client, "project-123");
  assert.deepEqual(calls, [
    ["from", "intelligence_projects"],
    ["delete"],
    ["delete.eq", "id", "project-123"],
    ["from", "intelligence_projects"],
    ["select", "id"],
    ["select.eq", "id", "project-123"],
    ["maybeSingle"],
  ]);
});

test("cloud deletion fails safely when the project remains visible", async () => {
  const { client } = clientWith({ remaining: { id: "project-123" } });
  await assert.rejects(
    deleteProjectRow(client, "project-123"),
    /not permitted by the database/,
  );
});

test("cloud deletion propagates database errors", async () => {
  const { client } = clientWith({ deleteError: new Error("RLS denied") });
  await assert.rejects(deleteProjectRow(client, "project-123"), /RLS denied/);
});
