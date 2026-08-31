import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("CRM and Intelligence expose distinct browser identities", () => {
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(app, /VIMALUX CRM/);
  assert.match(app, /favicon-crm\.svg/);
  assert.match(app, /favicon-intelligence\.svg/);
  assert.match(html, /favicon-intelligence\.svg/);
});
