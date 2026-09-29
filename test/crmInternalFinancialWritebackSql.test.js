import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/internal_financial_writeback.sql", import.meta.url), "utf8");

test("internal financial writeback updates only approved Intelligence-owned cost columns", () => {
  for (const column of [
    "luminaire_costs",
    "datek_costs",
    "felicity_costs",
    "installation_costs",
    "freight_costs",
    "other_direct_costs",
    "agent_commission",
    "finance_costs",
  ]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }

  for (const crmOwnedColumn of [
    "cash_selling_price",
    "financed_selling_price",
    "margin_basis_eur",
    "bonus",
    "minimum_margin_pct",
    "revenue_basis",
  ]) {
    assert.doesNotMatch(sql, new RegExp(`\\b${crmOwnedColumn}\\s*=`), `${crmOwnedColumn} must not be overwritten`);
  }
});

test("internal financial writeback has an explicit rollback path", () => {
  assert.match(sql, /drop trigger if exists trg_sync_intelligence_internal_financials/i);
  assert.match(sql, /drop function if exists public\.sync_intelligence_internal_financials_to_project/i);
});
