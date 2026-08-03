# VIMALUX Intelligence v1.0

Production-ready preliminary business-case platform for municipal street-lighting upgrades. The app covers customer and project data, existing-light imports, proposed LED and smart-lighting solutions, project pricing, assumptions, financial analysis, and a customer-facing PDF report.

## Architecture

- React and Vite frontend
- A single calculation engine in `src/calculations.js`
- Supabase authentication and persistent catalogue/project storage
- Safe local/cloud project reconciliation using update timestamps
- PDF generation with jsPDF
- Italian and English user interface

## Local setup

1. Install dependencies with `npm install`.
2. Create `.env.local` containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Start the app with `npm run dev`.

The Supabase project must contain the `intelligence_catalogue` and `intelligence_projects` tables and the associated authenticated-user policies.

## Verification

- `npm test` runs the calculation, import, project-sync, and report tests.
- `npm run build` creates the production bundle in `dist`.
