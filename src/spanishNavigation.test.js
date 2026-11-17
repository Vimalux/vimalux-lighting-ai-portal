import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultProject, migrateProject } from "./model.js";
import { formatNumber, locale, useT } from "./i18n.js";

test("Spanish is available for the shared Intelligence and CRM navigation", () => {
  const t = useT("es");
  assert.equal(t("customer"), "Cliente y proyecto");
  assert.equal(t("business"), "Análisis económico");
  assert.equal(t("projects"), "Proyectos");
  assert.equal(t("crm"), "CRM");
  assert.equal(t("partners"), "Socios");
  assert.equal(t("partnerReports"), "Informes para socios");
  assert.equal(t("internalReport"), "Informe interno");
  assert.equal(t("signout"), "Cerrar sesión");
});

test("saving and loading a Spanish project preserves language and business values", () => {
  const original = defaultProject({ applyStoredDefaults: false });
  original.language = "es";
  original.assumptions.energyPrice = 0.15;
  original.assumptions.financingPeriod = 10;
  const persisted = migrateProject(JSON.parse(JSON.stringify(original)));
  assert.equal(persisted.language, "es");
  assert.equal(persisted.assumptions.energyPrice, 0.15);
  assert.equal(persisted.assumptions.financingPeriod, 10);
  assert.equal(locale("es"), "es-BO");
  assert.ok(formatNumber(1234, "es").includes("1"));
});

test("existing Italian and English translations remain unchanged", () => {
  assert.equal(useT("it")("projects"), "Progetti");
  assert.equal(useT("en")("projects"), "Projects");
  assert.equal(useT("da")("projects"), "Projekter");
});

test("both Intelligence and CRM share the visible Spanish language selector", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /<option value="es">Español<\/option>/);
  assert.match(app, /onClick=\{\(\) => setView\("crm"\)\}>\{t\("crm"\)\}/);
  assert.match(app, /onClick=\{\(\) => setView\("partnerReports"\)\}>\{t\("partnerReports"\)\}/);
  assert.match(app, /<CrmOpportunity projects=/);
  assert.match(app, /<CommercialApprovalPanel project=/);
});
