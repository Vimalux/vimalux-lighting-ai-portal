from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)


# 1) Calculation result: expose the first full year where cumulative customer cash flow is non-negative.
calc_path = "src/calculationsBase.js"
calc = read(calc_path)
calc = replace_once(
    calc,
    "  const roiPercent = totalCapex > 0 ? annualOperationalBenefit / totalCapex * 100 : 0;\n  const lifecycleResult = cumulative;",
    "  const roiPercent = totalCapex > 0 ? annualOperationalBenefit / totalCapex * 100 : 0;\n  const cashBreakEvenYear = cashFlowRows.find((row) => Number(row.cumulative) >= 0)?.year ?? null;\n  const lifecycleResult = cumulative;",
    "cash break-even calculation",
)
calc = replace_once(
    calc,
    "    customerAnnualNetBenefit, payback, roiPercent, npv, lifecycleResult, analysisPeriod, energyReductionPercent, upgradedEnergyReductionPercent, co2ReductionKg, decisionStatus, customerDecisionStatus,",
    "    customerAnnualNetBenefit, payback, roiPercent, cashBreakEvenYear, npv, lifecycleResult, analysisPeriod, energyReductionPercent, upgradedEnergyReductionPercent, co2ReductionKg, decisionStatus, customerDecisionStatus,",
    "cash break-even return value",
)
write(calc_path, calc)


# 2) Economic Analysis: primary customer KPIs depend on commercial model.
app_path = "src/App.jsx"
app = read(app_path)
start = app.find("function Kpis(")
end = app.find("function Business(", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate Kpis function")
new_kpis = r'''function Kpis({ p, r, t, money, num }) {
  const it = p.language === "it";
  const cashDeal = r.dealType === "cash";
  const financed = !cashDeal;
  const allInclusive = r.dealType === "noleggio_operativo";
  const luminaires = Math.max(1, r.upgradedQuantity);
  const money2 = (value) => formatMoney(value, p.language, p.project.currency, 2);
  const serviceOpexMonthly = (r.totalAnnualOpex || 0) / 12;
  const operationalPaybackLabel = it ? "Payback operativo (escl. finanziamento)" : "Operational payback (excl. financing)";
  const operationalRoiLabel = it ? "ROI operativo (escl. finanziamento)" : "Operational ROI (excl. financing)";
  const cashBreakEvenLabel = it ? "Break-even cash cumulato" : "Cumulative cash break-even";
  const customerInitialInvestmentLabel = it ? "CAPEX iniziale cliente" : "Customer upfront CAPEX";
  const technicalMetricsTitle = it ? "Metriche tecniche del progetto" : "Technical project metrics";
  const technicalMetricsHint = it
    ? "Queste metriche descrivono l'economia tecnica del progetto e sono indipendenti dalla struttura di finanziamento del cliente."
    : "These metrics describe the technical project economics and are independent of the customer's financing structure.";
  const breakEvenValue = r.cashBreakEvenYear == null ? t("notAvailable") : `${it ? "Anno" : "Year"} ${r.cashBreakEvenYear}`;
  const firstYearCashPositive = Number(r.cashFlowRows?.[0]?.cumulative || 0) >= 0;
  const customerInitialInvestment = cashDeal ? r.totalCapex : Number(p.assumptions.upfrontPayment || 0);
  const paymentKpis = allInclusive
    ? [[it ? "Canone mensile LaaS / Noleggio tutto incluso" : "Monthly LaaS / all-inclusive payment", money2(r.monthlyPayment)], [it ? "OPEX servizi / mese (incluso nel canone)" : "Service OPEX / month (included in payment)", money2(serviceOpexMonthly)], [it ? "Canone mensile per apparecchio" : "Monthly payment per luminaire", money2(r.monthlyPayment / luminaires)]]
    : r.dealType === "finance"
      ? [[it ? "Rata mensile finanziamento CAPEX" : "Monthly CAPEX financing payment", money2(r.financingMonthlyPayment)], [it ? "OPEX servizi / mese" : "Service OPEX / month", money2(serviceOpexMonthly)], [it ? "Pagamento mensile totale cliente" : "Total monthly customer payment", money2(r.monthlyPayment)], [it ? "Pagamento totale per apparecchio" : "Total payment per luminaire", money2(r.monthlyPayment / luminaires)]]
      : [[it ? "OPEX servizi / mese" : "Service OPEX / month", money2(serviceOpexMonthly)]];
  const list = [
    [cashDeal ? t("capex") : customerInitialInvestmentLabel, money(customerInitialInvestment)],
    ...paymentKpis,
    [it ? "OPEX annuo per apparecchio" : "Annual OPEX per luminaire", money2(r.totalAnnualOpex / luminaires)],
    ...(r.powerAidEnabled ? [[it ? "Adaptive Dimming service fee annua" : "Annual Adaptive Dimming service fee", money2(r.powerAidCustomerFee)], [it ? "Beneficio netto cliente Adaptive Dimming" : "Customer net Adaptive Dimming benefit", money2(r.powerAidCustomerNetBenefit), "positive"]] : []),
    [t("annualNet"), money(r.customerAnnualNetBenefit)],
    ...(cashDeal
      ? [[operationalPaybackLabel, r.payback == null ? t("notAvailable") : `${num(r.payback, 1)} ${t("years")}`], [operationalRoiLabel, formatPercent(r.roiPercent, p.language)], [cashBreakEvenLabel, breakEvenValue]]
      : [[it ? "Cash flow cliente positivo dal primo anno" : "Customer cash flow positive from year one", firstYearCashPositive ? (it ? "Sì" : "Yes") : (it ? "No" : "No")]]),
    [`${t("npv")} – ${r.analysisPeriod} ${t("years")}`, money(r.npv)],
    [`${t("lifecycle")} – ${r.analysisPeriod} ${t("years")}`, money(r.lifecycleResult)],
    [it ? "Riduzione intera installazione" : "Whole-installation reduction", formatPercent(r.energyReductionPercent, p.language)],
    [it ? "Riduzione apparecchi aggiornati" : "Upgraded-luminaire reduction", formatPercent(r.upgradedEnergyReductionPercent, p.language)],
    [t("co2Reduction"), `${num(r.co2ReductionKg / 1000, 1)} t`],
  ];
  return <>
    <div className="kpis">{list.map(([l, v, c]) => <div className={`kpi ${c || ""}`} key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>
    {financed && <Card title={technicalMetricsTitle}>
      <div className="breakdown">
        <div><span>{operationalPaybackLabel}</span><span></span><strong>{r.payback == null ? t("notAvailable") : `${num(r.payback, 1)} ${t("years")}`}</strong></div>
        <div><span>{operationalRoiLabel}</span><span></span><strong>{formatPercent(r.roiPercent, p.language)}</strong></div>
      </div>
      <p className="hint">{technicalMetricsHint}</p>
    </Card>}
  </>;
}
'''
app = app[:start] + new_kpis + app[end:]
write(app_path, app)


# 3) PDF Executive Summary: cash and financed models use different primary customer semantics.
report_path = "src/report.js"
report = read(report_path)
start = report.find('  const paybackLabel = it ? "Payback operativo (escl. finanziamento)"')
end_marker = '  autoTable(doc, {\n    startY: doc.lastAutoTable.finalY + 38,'
end = report.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate PDF executive summary block")
new_summary = r'''  const paybackLabel = it ? "Payback operativo (escl. finanziamento)" : "Operational payback (excl. financing)";
  const roiLabel = it ? "ROI operativo (escl. finanziamento)" : "Operational ROI (excl. financing)";
  const cashDeal = result.dealType === "cash";
  const cashBreakEvenYear = result.cashBreakEvenYear ?? result.cashFlowRows?.find((row) => Number(row.cumulative) >= 0)?.year ?? null;
  const cashBreakEvenValue = cashBreakEvenYear == null ? t("notAvailable") : `${it ? "Anno" : "Year"} ${cashBreakEvenYear}`;
  const firstYearCashPositive = Number(result.cashFlowRows?.[0]?.cumulative || 0) >= 0;
  const customerInitialInvestment = cashDeal ? result.totalCapex : Number(project.assumptions.upfrontPayment || 0);
  const paymentLabel = result.dealType === "noleggio_operativo"
    ? (it ? "Canone mensile cliente" : "Customer monthly canone")
    : (it ? "Pagamento mensile totale cliente" : "Total monthly customer payment");
  const opexLabel = result.dealType === "noleggio_operativo"
    ? (it ? "OPEX mensile (incluso nel canone)" : "Monthly OPEX (included in payment)")
    : (it ? "OPEX mensile" : "Monthly OPEX");
  const executiveHead = cashDeal
    ? [t("preliminary"), it ? "Investimento iniziale" : "Initial investment", opexLabel, `${t("annualNet")}*`, roiLabel, paybackLabel, it ? "Break-even cash cumulato" : "Cumulative cash break-even"]
    : [t("preliminary"), it ? "CAPEX iniziale cliente" : "Customer upfront CAPEX", paymentLabel, opexLabel, `${t("annualNet")}*`, it ? "Cash flow positivo dal primo anno" : "Positive cash flow from year one", t("npv")];
  const executiveBody = cashDeal
    ? [(result.customerCashDecisionStatus ?? result.customerDecisionStatus).replace("_", "-"), money(customerInitialInvestment), money2(result.totalAnnualOpex / 12), money(result.customerCashAnnualNetBenefit ?? result.customerAnnualNetBenefit), percent(result.roiPercent), result.payback == null ? t("notAvailable") : `${formatNumber(result.payback, lang, 1)} ${t("years")}`, cashBreakEvenValue]
    : [(result.customerCashDecisionStatus ?? result.customerDecisionStatus).replace("_", "-"), money(customerInitialInvestment), money2(result.customerGrossMonthlyPayment ?? result.monthlyPayment), money2(result.totalAnnualOpex / 12), money(result.customerCashAnnualNetBenefit ?? result.customerAnnualNetBenefit), firstYearCashPositive ? (it ? "Sì" : "Yes") : (it ? "No" : "No"), money(result.npv)];
  autoTable(doc, {
    startY: 57,
    theme: "grid",
    head: [executiveHead],
    body: [executiveBody],
    headStyles: { fillColor: [15, 118, 110] },
    styles: { font: "helvetica", fontSize: 6.4, cellPadding: 1.6, valign: "middle" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    didParseCell: alignTableHeaders("left", "right", "right", "right", "right", "right", "right"),
  });
  doc.setFontSize(10);
  doc.text(t(result.customerDecisionStatus), 14, doc.lastAutoTable.finalY + 8, { maxWidth: 182 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(commercial.annualNetFootnote, 14, doc.lastAutoTable.finalY + 14, { maxWidth: 182 });
  if (!cashDeal) {
    doc.text(`${it ? "Metriche tecniche del progetto - indipendenti dal finanziamento" : "Technical project metrics - independent of financing"}: ${paybackLabel} ${result.payback == null ? t("notAvailable") : `${formatNumber(result.payback, lang, 1)} ${t("years")}`} · ${roiLabel} ${percent(result.roiPercent)}`, 14, doc.lastAutoTable.finalY + 19, { maxWidth: 182 });
  }
  doc.setFont("helvetica", "normal");
  const energySummaryY = doc.lastAutoTable.finalY + (cashDeal ? 19 : 24);
  doc.text(`${t("energyReduction")}: ${percent(result.energyReductionPercent)}   |   ${it ? "Riduzione CO2" : "CO2 reduction"}: ${formatNumber(result.co2ReductionKg / 1000, lang, 1)} t/${it ? "anno" : "year"}`, 14, energySummaryY, { maxWidth: 182 });
  doc.setTextColor(15, 23, 42);

  const customerSectionOffset = cashDeal ? 33 : 38;
  const customerSectionTableOffset = cashDeal ? 38 : 43;
  section(it ? "Cliente e progetto" : "Customer and project", doc.lastAutoTable.finalY + customerSectionOffset);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + customerSectionTableOffset,'''
report = report[:start] + new_summary + report[end + len(end_marker):]
write(report_path, report)


# 4) Regression coverage.
test_path = ROOT / "test/customerFinancialSemantics.test.js"
test_path.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";

test("cashBreakEvenYear equals first full year with non-negative cumulative customer cash flow", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  const result = calculateBusinessCase(project);
  const expected = result.cashFlowRows.find((row) => Number(row.cumulative) >= 0)?.year ?? null;
  assert.equal(result.cashBreakEvenYear, expected);
});

test("Economic Analysis separates cash payback from financed customer semantics", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /CAPEX iniziale cliente/);
  assert.match(source, /Break-even cash cumulato/);
  assert.match(source, /Cash flow cliente positivo dal primo anno/);
  assert.match(source, /Metriche tecniche del progetto/);
  assert.match(source, /indipendenti dalla struttura di finanziamento/);
});

test("PDF Executive Summary uses model-specific semantics and retains technical metrics only as secondary information for financed deals", () => {
  const source = fs.readFileSync(new URL("../src/report.js", import.meta.url), "utf8");
  assert.match(source, /const executiveHead = cashDeal/);
  assert.match(source, /CAPEX iniziale cliente/);
  assert.match(source, /Break-even cash cumulato/);
  assert.match(source, /Cash flow positivo dal primo anno/);
  assert.match(source, /Metriche tecniche del progetto - indipendenti dal finanziamento/);
});
''', encoding="utf-8")

print("Customer ROI/payback semantics patched successfully")
