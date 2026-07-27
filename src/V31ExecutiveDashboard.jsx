import React from "react";

function number(value) {
  return Number(value) || 0;
}

function money(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(number(value));
}

function decimal(value, digits = 1) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number(value));
}

const LABELS = {
  it: {
    executive: "Sintesi economica",
    npv: "VAN",
    irr: "TIR",
    roi: "ROI progetto",
    co2: "CO₂ annua evitata",
    netBenefit: "Beneficio netto",
    energy: "Composizione del risparmio energetico",
    cashFlow: "Cash flow cumulativo",
    led: "Conversione LED",
    clo: "CLO",
    smart: "Profilo Smart",
    powerAid: "PowerAiD",
    hybrid: "Hybrid PV",
    residual: "Consumo residuo",
    year: "Anno",
    cumulative: "Cumulativo",
    investment: "Investimento",
    breakEven: "Break-even",
  },
  en: {
    executive: "Financial overview",
    npv: "NPV",
    irr: "IRR",
    roi: "Project ROI",
    co2: "Annual CO₂ avoided",
    netBenefit: "Net benefit",
    energy: "Energy saving composition",
    cashFlow: "Cumulative cash flow",
    led: "LED conversion",
    clo: "CLO",
    smart: "Smart profile",
    powerAid: "PowerAiD",
    hybrid: "Hybrid PV",
    residual: "Residual consumption",
    year: "Year",
    cumulative: "Cumulative",
    investment: "Investment",
    breakEven: "Break-even",
  },
};

export default function V31ExecutiveDashboard({ calculation, lang = "it" }) {
  if (!calculation?.totals || !calculation?.finance) return null;

  const t = LABELS[lang] || LABELS.it;
  const { totals, finance } = calculation;
  const baseline = Math.max(1, number(totals.baselineKwh));

  const energySegments = [
    { label: t.led, value: totals.ledEnergySavingKwh, tone: "#16a34a" },
    { label: t.clo, value: totals.cloSavingKwh, tone: "#22c55e" },
    { label: t.smart, value: totals.smartProfileSavingKwh, tone: "#2563eb" },
    { label: t.powerAid, value: totals.powerAidSavingKwh, tone: "#7c3aed" },
    { label: t.hybrid, value: totals.hybridSavingKwh, tone: "#f59e0b" },
    { label: t.residual, value: totals.residualGridKwh, tone: "#cbd5e1" },
  ].filter((segment) => number(segment.value) > 0);

  const maxAbsoluteCashFlow = Math.max(
    number(totals.totalCapex),
    ...finance.yearly.map((row) => Math.abs(number(row.cumulative))),
    1
  );

  const displayedYears = finance.yearly.filter(
    (row, index) => index === 0 || index === finance.yearly.length - 1 || (row.year % 2 === 0)
  );

  const breakEvenYear = finance.yearly.find((row) => row.cumulative >= 0)?.year;

  return (
    <section style={styles.wrapper}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.heading}>{t.executive}</h2>
          <div style={styles.subheading}>{finance.years} years · {decimal(finance.discountRate)}% discount rate</div>
        </div>
        {breakEvenYear && <div style={styles.breakEven}>{t.breakEven}: {t.year} {breakEvenYear}</div>}
      </div>

      <div style={styles.kpiGrid}>
        <Metric label={t.npv} value={money(finance.npv)} positive={finance.npv >= 0} />
        <Metric label={t.irr} value={finance.irr === null ? "–" : `${decimal(finance.irr)}%`} positive={number(finance.irr) >= number(finance.discountRate)} />
        <Metric label={t.roi} value={`${decimal(finance.roiPct)}%`} positive={finance.roiPct >= 0} />
        <Metric label={t.netBenefit} value={money(finance.netBenefit)} positive={finance.netBenefit >= 0} />
        <Metric label={t.co2} value={`${decimal(finance.annualCo2Tonnes)} t`} positive />
      </div>

      <div style={styles.dashboardGrid}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>{t.energy}</h3>
          <div style={styles.energyBar}>
            {energySegments.map((segment) => (
              <div
                key={segment.label}
                title={`${segment.label}: ${decimal(segment.value / 1000)} MWh`}
                style={{
                  width: `${Math.max(0.5, (number(segment.value) / baseline) * 100)}%`,
                  background: segment.tone,
                }}
              />
            ))}
          </div>
          <div style={styles.legend}>
            {energySegments.map((segment) => (
              <div key={segment.label} style={styles.legendItem}>
                <span style={{ ...styles.dot, background: segment.tone }} />
                <span>{segment.label}</span>
                <strong>{decimal(segment.value / 1000)} MWh</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>{t.cashFlow}</h3>
          <div style={styles.cashChart}>
            <CashBar
              label="0"
              value={-number(totals.totalCapex)}
              maximum={maxAbsoluteCashFlow}
              negative
            />
            {displayedYears.map((row) => (
              <CashBar
                key={row.year}
                label={String(row.year)}
                value={row.cumulative}
                maximum={maxAbsoluteCashFlow}
                negative={row.cumulative < 0}
              />
            ))}
          </div>
          <div style={styles.chartFooter}>
            <span>{t.investment}: {money(totals.totalCapex)}</span>
            <span>{t.cumulative}: {money(finance.yearly.at(-1)?.cumulative || 0)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, positive }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={{ ...styles.metricValue, color: positive ? "#166534" : "#b91c1c" }}>{value}</strong>
    </div>
  );
}

function CashBar({ label, value, maximum, negative }) {
  const height = Math.max(6, (Math.abs(number(value)) / maximum) * 150);
  return (
    <div style={styles.cashColumn} title={`${label}: ${money(value)}`}>
      <div style={styles.cashValue}>{money(value)}</div>
      <div style={styles.cashPlot}>
        <div
          style={{
            ...styles.cashBar,
            height,
            background: negative ? "#ef4444" : "#16a34a",
            alignSelf: negative ? "flex-start" : "flex-end",
          }}
        />
      </div>
      <div style={styles.cashLabel}>{label}</div>
    </div>
  );
}

const styles = {
  wrapper: {
    background: "#ffffff",
    border: "1px solid #dce4ef",
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  heading: { margin: 0 },
  subheading: { color: "#64748b", marginTop: 5, fontSize: 13 },
  breakEven: {
    background: "#ecfdf5",
    color: "#166534",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 800,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 16,
  },
  metric: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  metricLabel: { color: "#64748b", fontSize: 12, fontWeight: 700 },
  metricValue: { fontSize: 20 },
  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
  },
  panel: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    minWidth: 0,
  },
  panelTitle: { margin: "0 0 14px", fontSize: 16 },
  energyBar: {
    height: 28,
    borderRadius: 999,
    overflow: "hidden",
    display: "flex",
    background: "#f1f5f9",
  },
  legend: { display: "grid", gap: 8, marginTop: 14 },
  legendItem: {
    display: "grid",
    gridTemplateColumns: "12px 1fr auto",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 999 },
  cashChart: {
    minHeight: 220,
    display: "flex",
    alignItems: "stretch",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 4,
  },
  cashColumn: {
    minWidth: 54,
    flex: "1 0 54px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  cashPlot: {
    height: 160,
    width: "100%",
    display: "flex",
    justifyContent: "center",
    borderBottom: "1px solid #cbd5e1",
  },
  cashBar: { width: 22, borderRadius: "6px 6px 0 0" },
  cashValue: { fontSize: 9, color: "#64748b", height: 28, whiteSpace: "nowrap" },
  cashLabel: { fontSize: 11, fontWeight: 800, marginTop: 5 },
  chartFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 12,
    marginTop: 10,
  },
};
