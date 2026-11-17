import test from "node:test";
import assert from "node:assert/strict";
import { commercialReleaseState, commercialReleaseLabel, isFinalCommercialOfferAuthorized } from "../src/commercialApproval.js";

const customerGo = { customerDecisionStatus: "GO", decisionStatus: "REVIEW" };

test("customer GO with internal REVIEW requires VIMALUX approval, never auto-releases", () => {
  assert.equal(commercialReleaseState(customerGo, { phase: "loaded", approved: false }), "pending_admin");
  assert.equal(isFinalCommercialOfferAuthorized(commercialReleaseState(customerGo, { phase: "loaded", approved: false })), false);
  assert.equal(commercialReleaseState(customerGo, { phase: "loaded", approved: true }), "approved_exception");
  assert.equal(isFinalCommercialOfferAuthorized("approved_exception"), true);
});

test("an Agent never self-authorizes from incomplete internal economics", () => {
  const agentCalculatedGo = { customerDecisionStatus: "GO", decisionStatus: "GO" };
  assert.equal(commercialReleaseState(agentCalculatedGo, { phase: "loaded", approved: false }, "saved", true), "pending_admin");
  assert.equal(commercialReleaseState(agentCalculatedGo, { phase: "loaded", approved: true }, "saved", true), "approved_by_vimalux");
  assert.equal(commercialReleaseState(agentCalculatedGo, { phase: "error" }, "saved", true), "unverified");
  assert.equal(isFinalCommercialOfferAuthorized(commercialReleaseState(agentCalculatedGo, { phase: "loaded", approved: false }, "saved", true)), false);
});

test("server unavailable, unsaved updates and negative customer case fail closed", () => {
  assert.equal(commercialReleaseState(customerGo, { phase: "error" }), "unverified");
  assert.equal(commercialReleaseState(customerGo, { phase: "loaded", approved: true }, "saving"), "pending_sync");
  assert.equal(commercialReleaseState({ customerDecisionStatus: "NO_GO", decisionStatus: "GO" }, { phase: "loaded", approved: true }), "customer_review");
  assert.equal(commercialReleaseState({ customerDecisionStatus: "GO", decisionStatus: "NO_GO" }, { phase: "loaded", approved: true }), "blocked");
});

test("internal GO can proceed without exception but customer preliminary GO remains distinct", () => {
  assert.equal(commercialReleaseState({ customerDecisionStatus: "GO", decisionStatus: "GO" }), "approved_by_policy");
  assert.match(commercialReleaseLabel("pending_admin", "it"), /approvazione commerciale VIMALUX/);
  assert.match(commercialReleaseLabel("pending_admin", "da"), /VIMALUX/);
});
