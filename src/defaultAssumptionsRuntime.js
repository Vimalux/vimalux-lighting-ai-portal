import {
  BASE_ASSUMPTIONS,
  DEFAULT_ASSUMPTIONS_STORAGE_KEY,
  readStoredDefaultAssumptions,
} from "./model.js";

const groups = [
  {
    title: "Tecnica",
    fields: [
      ["operatingHours", "Ore operative annue"],
      ["energyPrice", "Prezzo energia (EUR/kWh)"],
      ["sapFactor", "Fattore SAP"],
      ["mhFactor", "Fattore MH"],
      ["mercuryFactor", "Fattore Mercury"],
      ["co2KgPerKwh", "CO₂ kg/kWh"],
    ],
  },
  {
    title: "Risparmi",
    fields: [
      ["cloPercent", "Percentuale CLO (%)"],
      ["powerAidPercent", "Risparmio PowerAiD (%)"],
      ["powerAidCustomerFeePercent", "Fee cliente PowerAiD (%)"],
      ["powerAidSupplierSharePercent", "Costo interno/fornitore (% fee cliente)"],
      ["existingMaintenance", "Manutenzione esistente / lampada / anno"],
      ["newMaintenance", "Nuova manutenzione / lampada / anno"],
    ],
  },
  {
    title: "Finanziaria",
    fields: [
      ["serviceAgreementPeriod", "Periodo accordo servizi (anni)"],
      ["financingPeriod", "Periodo finanziamento (anni)"],
      ["analysisPeriod", "Periodo di analisi (anni)"],
      ["interestRate", "Tasso interesse (%)"],
      ["upfrontPayment", "Anticipo"],
      ["energyEscalation", "Aumento energia (%)"],
      ["opexEscalation", "Aumento OPEX (%)"],
      ["discountRate", "Tasso di attualizzazione (%)"],
    ],
  },
  {
    title: "Trasporto",
    fields: [
      ["freightCostPerLamp", "Costo trasporto / lampada"],
      ["freightSalesPerLamp", "Prezzo trasporto / lampada"],
      ["dutyCost", "Dazi / costo doganale"],
    ],
  },
];

const style = `
  position:fixed; inset:0; z-index:100000; background:rgba(7,18,34,.62);
  align-items:flex-start; justify-content:center; overflow:auto; padding:28px;
`;

function hideModal(overlay) {
  overlay.style.display = "none";
}

function showModal(overlay) {
  overlay.style.display = "flex";
}

function modal() {
  const existing = document.getElementById("vimalux-default-assumptions-modal");
  if (existing) return existing;
  const overlay = document.createElement("div");
  overlay.id = "vimalux-default-assumptions-modal";
  overlay.style.cssText = style;
  hideModal(overlay);
  overlay.innerHTML = `
    <div style="width:min(1080px,96vw);background:#fff;border-radius:16px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.28);font-family:inherit;color:#10223a">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px">
        <div>
          <div style="font-size:13px;color:#5c6f83;margin-bottom:4px">VIMALUX Intelligence · Admin</div>
          <h2 style="margin:0 0 6px;font-size:26px">Impostazioni Default</h2>
          <div style="color:#5c6f83;max-width:760px">Questi valori vengono applicati solo ai nuovi Business Case. I progetti esistenti non vengono modificati.</div>
        </div>
        <button type="button" data-default-close style="border:1px solid #d4dde7;background:#fff;border-radius:9px;padding:9px 13px;cursor:pointer">Chiudi</button>
      </div>
      <div data-default-groups style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;border-top:1px solid #e4eaf0;padding-top:18px">
        <button type="button" data-default-reset style="border:1px solid #cbd6e2;background:#fff;border-radius:9px;padding:10px 15px;cursor:pointer">Ripristina standard</button>
        <button type="button" data-default-save style="border:0;background:#087f72;color:#fff;border-radius:9px;padding:10px 18px;font-weight:700;cursor:pointer">Salva default</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const holder = overlay.querySelector("[data-default-groups]");
  groups.forEach((group) => {
    const card = document.createElement("section");
    card.style.cssText = "border:1px solid #dce4ec;border-radius:12px;padding:16px;background:#fbfcfd";
    card.innerHTML = `<h3 style="margin:0 0 13px;font-size:18px">${group.title}</h3><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px" data-fields></div>`;
    const fields = card.querySelector("[data-fields]");
    group.fields.forEach(([key, label]) => {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#40566d";
      wrap.innerHTML = `<span>${label}</span><input data-default-key="${key}" inputmode="decimal" style="width:100%;box-sizing:border-box;border:1px solid #cbd7e3;border-radius:8px;padding:9px 10px;font:inherit;background:#fff;color:#14283d">`;
      fields.appendChild(wrap);
    });
    holder.appendChild(card);
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-default-close]")) hideModal(overlay);
  });
  overlay.querySelector("[data-default-reset]").addEventListener("click", () => fill(overlay, BASE_ASSUMPTIONS));
  overlay.querySelector("[data-default-save]").addEventListener("click", () => {
    const values = { ...readStoredDefaultAssumptions() };
    overlay.querySelectorAll("[data-default-key]").forEach((input) => {
      const key = input.dataset.defaultKey;
      const parsed = Number(String(input.value).replace(",", "."));
      if (Number.isFinite(parsed)) values[key] = parsed;
    });
    values.financingYears = values.financingPeriod;
    values.contractYears = values.serviceAgreementPeriod;
    values.rateProfileId = "custom";
    values.interestRateSnapshot = { profileId: "custom", annualRate: values.interestRate, capturedAt: null };
    localStorage.setItem(DEFAULT_ASSUMPTIONS_STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), values }));
    hideModal(overlay);
  });
  return overlay;
}

function fill(overlay, values) {
  overlay.querySelectorAll("[data-default-key]").forEach((input) => {
    const value = values[input.dataset.defaultKey];
    input.value = value == null ? "" : String(value).replace(".", ",");
  });
}

function openDefaults() {
  const overlay = modal();
  fill(overlay, readStoredDefaultAssumptions());
  showModal(overlay);
}

function installMenu() {
  if (document.querySelector("[data-vimalux-default-assumptions]")) return;
  const candidates = [...document.querySelectorAll("button,a")];
  const anchor = candidates.find((node) => /amministrazione prezzi/i.test(node.textContent || ""));
  const adminEvidence = candidates.some((node) => /catalogo prodotti/i.test(node.textContent || ""));
  if (!anchor || !adminEvidence) return;
  const item = document.createElement(anchor.tagName.toLowerCase() === "a" ? "a" : "button");
  item.type = item.tagName === "BUTTON" ? "button" : undefined;
  item.dataset.vimaluxDefaultAssumptions = "1";
  item.className = anchor.className;
  item.textContent = "Impostazioni Default";
  if (item.tagName === "A") item.href = "#default-assumptions";
  item.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDefaults();
  });
  anchor.insertAdjacentElement("afterend", item);
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(installMenu);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installMenu, { once: true });
  else installMenu();
}
