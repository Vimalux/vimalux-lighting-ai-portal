# VIMALUX SAFE RELEASE — Agent Business Cases and shared defaults

Status: **staging validation only**. Do not merge to `main` or promote to
`app.vimalux.com` until a named VIMALUX reviewer approves the checklist.

## Database and release order

1. Keep the current production deployment and database unchanged. The schema
   migration `20261116181633_global_intelligence_defaults.sql` has been applied
   to the **staging** Supabase project `jjmfvxbfljixdqyibeza` only.
2. Deploy the feature branch to a **preview** Vercel URL; use `?staging_auth=1`
   for real staging authentication. Other preview URLs are local-only demos.
3. Validate the actual staging agent/admin roles and the flows below. Reconcile
   the seeded defaults with the authorised Admin configuration.
4. For any later production release, apply the reviewed migration to production
   **before** promoting the compatible front-end. Take a database backup and
   preserve the prior Vercel production deployment.
5. Do not edit existing Business Case assumptions automatically. Historic
   €4/lamp transport costs require a separate review/approval.

## Staging acceptance checklist

- [ ] Admin sees global freight **cost €11** and **sales €12** per luminaire;
      Admin saves another setting, refreshes and sees that setting persisted.
- [ ] A second, independent signed-in browser receives the same new-case
      defaults, even if it previously had local `€4` assumptions.
- [ ] An agent cannot access Admin default controls, cannot overwrite the
      protected values via the network, and sees only allowed inputs.
- [ ] Open Albiano d'Ivrea and other legacy Business Cases: their original
      assumptions remain as saved; flag suspect historic prices for review.
- [ ] Agent edits a permitted input, waits for “Supabase sincronizzato”,
      reloads and sees the change from the central database.
- [ ] Agent disconnects during an edit: saving error and retry are visible;
      closing the tab prompts a warning until the data is synchronized.
- [ ] Agent sign-out/sign-in, direct Business Case links, import/reimport,
      CRM links, calculation, proposal PDF and project navigation still work.
- [ ] Admin workspaces, catalogue, existing saved projects and the CRM retain
      their earlier functionality.

## Recovery and rollback

- **Front-end:** keep the previous Vercel deployment available; redeploy it if
  acceptance fails. Do not erase the database or clear all browser storage.
- **Staging database:** if a full schema rollback is needed, first pause the
  new staging front-end. Drop the two new triggers and their functions, restore
  the prior definition of `agent_safe_business_case_data`, and finally drop
  the dedicated `intelligence_default_settings` table. Preserve any existing
  Business Cases and unrelated schema/data. Restore the prior function from
  the verified pre-release schema snapshot; do not guess its definition.
- **Production:** no migration or feature-branch changes have been applied.

Authentication sessions may still use browser storage (Supabase standard auth).
The change removes browser persistence as the source of **agent project data,
internal prices, defaults, and navigation**, not the login mechanism.
