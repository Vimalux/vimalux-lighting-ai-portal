const positive = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

// Nominal annual partner rate / 12, monthly payments in arrears, excluding VAT.
// Services and customer upfront payments are not part of the assigned receivable.
export function valueFinanceReceivables({ monthlyPayment, months, annualRatePercent, fee = 0 }) {
  const payment = positive(monthlyPayment);
  const count = Math.max(0, Math.round(positive(months)));
  const rate = positive(annualRatePercent) / 1200;
  const nominal = payment * count;
  const grossProceeds = rate === 0 ? nominal : Array.from({ length: count }, (_, index) => payment / Math.pow(1 + rate, index + 1))
    .reduce((sum, value) => sum + value, 0);
  const transferFee = positive(fee);
  return { nominal, grossProceeds, transferFee, netProceeds: grossProceeds - transferFee, discount: nominal - grossProceeds };
}
