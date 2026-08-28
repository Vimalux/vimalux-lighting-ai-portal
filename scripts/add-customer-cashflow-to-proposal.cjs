const fs = require('fs');

function patch(path, before, after) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Cashflow proposal patch target not found in ${path}`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}

patch(
  'src/businessCaseSync.js',
  '    annualCustomerNetBenefit: result.customerAnnualNetBenefit,\n    paybackYears: result.payback,',
  '    annualCustomerNetBenefit: result.customerAnnualNetBenefit,\n    cashFlowRows: (result.cashFlowRows || []).map((row) => ({ year: row.year, grossBenefit: row.grossBenefit, opex: row.opex, payment: row.payment, netCashFlow: row.netCashFlow, cumulative: row.cumulative })),\n    paybackYears: result.payback,'
);

patch(
  'src/preliminaryProposal.js',
  '  drawFooter(doc, doc.getNumberOfPages(), proposalId, version, lineage, it, muted);',
  `  // PAGE 3 — annual customer cash flow detail\n  const cashRows = Array.isArray(result.cashFlowRows) ? result.cashFlowRows : [];\n  if (cashRows.length) {\n    doc.addPage();\n    section(it ? "Flusso di cassa cliente" : "Customer Cash Flow", 20);\n    doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor(...muted);\n    doc.text(it\n      ? "Dettaglio annuale della sostenibilità economica per il Comune. La tabella mantiene separati beneficio lordo, OPEX e pagamento contrattuale/finanziario."\n      : "Annual detail of the municipality's economic sustainability. The table keeps gross benefit, OPEX and contractual/financing payment separate.", 14, 28, { maxWidth: 182 });\n    const allInclusive = String(project.assumptions?.dealType || "") === "noleggio_operativo";\n    autoTable(doc, {\n      startY: 38, theme: "grid",\n      head: [[it ? "Anno" : "Year", it ? "Beneficio lordo" : "Gross benefit", "OPEX", allInclusive ? (it ? "Canone tutto incluso" : "All-inclusive payment") : (it ? "Pagamento" : "Payment"), it ? "Flusso netto" : "Net cash flow", it ? "Cumulato" : "Cumulative"]],\n      body: cashRows.map((row) => [\n        String(row.year),\n        money(row.grossBenefit, lang),\n        allInclusive ? (it ? "Incluso" : "Included") : money(row.opex, lang),\n        money(row.payment, lang),\n        money(row.netCashFlow, lang),\n        money(row.cumulative, lang),\n      ]),\n      headStyles: { fillColor: teal },\n      alternateRowStyles: { fillColor: light },\n      styles: { font: "helvetica", fontSize: 7.1, cellPadding: 1.55 },\n      columnStyles: { 0: { halign: "center", cellWidth: 14 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },\n    });\n    const last = cashRows[cashRows.length - 1];\n    const first = cashRows[0];\n    const positiveYear = cashRows.find((row) => Number(row.cumulative) >= 0)?.year;\n    const summaryY = Math.min(268, doc.lastAutoTable.finalY + 9);\n    doc.setFillColor(...pale); doc.setDrawColor(167, 243, 208); doc.roundedRect(14, summaryY, 182, 16, 2, 2, "FD");\n    doc.setFont("helvetica", "bold"); doc.setFontSize(7.7); doc.setTextColor(...teal);\n    doc.text(it ? "Lettura sintetica" : "Summary reading", 18, summaryY + 5);\n    doc.setFont("helvetica", "normal"); doc.setTextColor(...navy);\n    const summaryText = it\n      ? \`Flusso netto anno 1: \${money(first?.netCashFlow, lang)} · Cumulato finale: \${money(last?.cumulative, lang)} · Cumulato positivo da: \${positiveYear ? \`anno \${positiveYear}\` : "oltre il periodo analizzato"}.\`\n      : \`Year 1 net cash flow: \${money(first?.netCashFlow, lang)} · Final cumulative: \${money(last?.cumulative, lang)} · Cumulative positive from: \${positiveYear ? \`year \${positiveYear}\` : "beyond the analysis period"}.\`;\n    doc.text(summaryText, 18, summaryY + 10, { maxWidth: 174 });\n  }\n\n  drawFooter(doc, doc.getNumberOfPages(), proposalId, version, lineage, it, muted);`
);

console.log('Customer cashflow detail added to preliminary proposal');
