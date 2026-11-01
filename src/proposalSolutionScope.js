const positive = value => Math.max(0, Number(value) || 0);

export function proposalSolutionScope(calculated = {}, legacy = {}, language = 'it') {
  const it = language === 'it';
  const upgrades = Math.round(positive(calculated.upgradedQuantity ?? legacy.upgradeLuminaires));
  const connected = Math.round(positive(calculated.smartQuantity ?? legacy.smartConnectedLuminaires));
  const nominal = positive(calculated.nominalSystemKwh);
  const existingSaving = positive(calculated.existingDimmingSavingKwh);
  const reduction = nominal ? existingSaving / nominal * 100 : 0;
  const percent = new Intl.NumberFormat(it ? 'it-IT' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(reduction);
  return {
    led: `${upgrades} ${it ? 'punti luce' : 'lighting points'}`,
    connected: `${connected} ${it ? 'punti luce Smart' : 'Smart lighting points'}`,
    adaptive: calculated.powerAidEnabled ? 'Adaptive Dimming' : (it
      ? 'Non incluso nella presente proposta. Eventuale servizio aggiuntivo da valutare separatamente.'
      : 'Not included in this proposal. Optional additional service to be assessed separately.'),
    existingDimmingRows: existingSaving > 0 ? [[it ? 'Dimmerazione fissa esistente' : 'Existing fixed dimming', it
      ? `Profilo configurato già incluso nel consumo di riferimento: riduzione media annua ${percent}%. Profilo da confermare sul sito.`
      : `Configured profile already included in baseline consumption: annual average reduction ${percent}%. Profile to be verified on site.`]] : [],
  };
}
