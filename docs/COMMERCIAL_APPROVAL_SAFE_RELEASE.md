# VIMALUX SAFE RELEASE — commercial offer authorization

**Environment**: staging only until Luciano validates both Admin and Agent flows.

## Business rule

Customer feasibility (`GO`) and internal VIMALUX profitability (`GO` / `REVIEW` / `NO_GO`) are separate assessments. The municipality can have a viable project while VIMALUX is below its 30% margin requirement.

- The Agent may download/email the *non-binding preliminary economic study* and the *Proposta Preliminare*. Both PDFs explicitly say they are not final offers. Generation is deliberately not blocked.
- Before an Agent sends a **binding final commercial offer**, Admin must approve the saved Business Case version, with a justification. For a case below the internal margin threshold, Admin is explicitly authorizing a commercial exception.
- An Agent cannot authorize from a locally computed margin because protected costs and commissions are intentionally absent from the Agent snapshot.
- `intelligence_commercial_approvals` stores an Admin-authored authorization separate from Agent-editable `intelligence_data`. Every Business Case save increments `sync_version`; an older approval becomes invalid, without editing or deleting historical case data.
- Agents read a boolean approval only; reason, approver and timestamp are returned to Admin only. All table access is denied and only authenticated, role-checked RPCs can access it.
- The Admin cannot grant an authorization through the UI for customer non-GO or internal NO_GO; those require project revision.

## Scope limitation

Intelligence currently generates **preliminary** documents only. The **final binding offer** is generated externally in VIMALUX Planner. The Planner final-issue workflow must query `get_intelligence_commercial_approval` for the same Business Case and enforce its return on the server before releasing a final document. A badge in Intelligence alone cannot technically block a PDF generated outside Intelligence.

## Staging verification

1. Apply the two SQL migrations to **staging** only; run Supabase security advisors.
2. Open a staging QA Business Case with customer GO/internal REVIEW. Admin should see a required justification field on `Rapporto Interno` and `Rapporto`, and may approve a saved version.
3. As the assigned Agent, open `Rapporto`. Confirm the badge changes from `In attesa di approvazione commerciale VIMALUX` to `Offerta definitiva autorizzata da VIMALUX` after refreshing, but no supplier costs, commissions or internal margin are visible.
4. Agent should still generate both preliminary PDFs and see the non-binding caveat.
5. Modify an approved staging QA Business Case, wait until `Supabase sincronizzato`, and verify Agent reverts to pending. Admin must explicitly reapprove; revocation also takes effect.
6. Verify unrelated existing Business Cases, project defaults, CRM sync and report exports have not changed.
7. Approve production migration + code promotion **separately**, after Admin/Agent validation. Retain previous Vercel production deployment for rollback. No production data rewrite.

## Automated verification

`npm test`, `npm run build`, and read-only/rerolled-back SQL impersonation of staging Agent and Admin roles. The staging SQL tests must leave zero persisted approvals on the QA fixture.
