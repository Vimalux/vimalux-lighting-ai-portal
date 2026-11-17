import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../src/CommercialApprovalPanel.jsx", import.meta.url), "utf8");
const preliminary = fs.readFileSync(new URL("../src/preliminaryProposalV2.js", import.meta.url), "utf8");
const customerReport = fs.readFileSync(new URL("../src/report.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261117060000_commercial_approval_gate.sql", import.meta.url), "utf8");

test("Admin internal report and Agent customer report show the same commercial approval panel", () => {
  assert.match(app, /view === "report" && <><CommercialApprovalPanel project=\{project\} result=\{approvalResult\} isAgent=\{isAgent\}/);
  assert.match(app, /view === "internalReport" && <><CommercialApprovalPanel project=\{project\} result=\{approvalResult\} canApprove/);
  assert.match(panel, /!isAgent && result &&/);
});

test("both customer-facing PDFs remain explicitly preliminary and non-binding", () => {
  assert.match(preliminary, /non vincolante/);
  assert.match(preliminary, /autorizzazione commerciale VIMALUX/);
  assert.match(preliminary, /proposal_status: "draft"/);
  assert.match(customerReport, /Non costituisce un'offerta commerciale definitiva/);
});

test("commercial authorization stays outside Agent-editable Business Case JSON", () => {
  assert.match(migration, /create table if not exists public\.intelligence_commercial_approvals/);
  assert.match(migration, /approved_sync_version = bc\.sync_version/);
  assert.match(migration, /if caller_id is null or not \(select public\.is_admin\(\)\)/);
  assert.match(migration, /revoke all on public\.intelligence_commercial_approvals from public, anon, authenticated/);
  assert.doesNotMatch(migration, /update public\.business_cases set/);
});
