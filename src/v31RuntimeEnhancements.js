const STYLE_ID = "vimalux-planner-alignment";

function installStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html, body, button, input, select, textarea { font-family: "Segoe UI", Arial, Helvetica, sans-serif !important; }
    aside .vimalux-brand-copy { display:grid!important; gap:1px!important; line-height:1.05!important; }
    aside .vimalux-brand-copy>b { font-size:17px!important; letter-spacing:.2px!important; }
    aside .vimalux-brand-copy>span { display:block!important; margin-top:3px!important; color:#9cb0b2!important; font-size:9px!important; font-weight:600!important; letter-spacing:.75px!important; text-transform:uppercase!important; }
    .vimalux-ai-recommendation-button { width:auto!important; min-width:210px!important; margin-top:7px!important; padding:8px 12px!important; border:1px solid #c9d7d9!important; border-radius:7px!important; background:#fff!important; color:#17363a!important; font-size:12px!important; font-weight:650!important; cursor:pointer!important; }
    .vimalux-ai-recommendation-button:hover { background:#f1f7f7!important; border-color:#8da6a9!important; }
    .vimalux-ai-recommendation-button.is-applied { background:#eaf8e7!important; border-color:#79ba6b!important; color:#17652b!important; }
    .vimalux-cashflow-chart { margin:4px 0 22px; padding:16px 18px 12px; border:1px solid #dfe7e8; border-radius:12px; background:#fbfdfd; }
    .vimalux-cashflow-chart-head { display:flex; justify-content:space-between; gap:16px; margin-bottom:10px; }
    .vimalux-cashflow-chart-head b { font-size:14px; }
    .vimalux-cashflow-chart-head span { color:#6e8285; font-size:11px; }
    .vimalux-cashflow-chart svg { display:block; width:100%; height:auto; }
    .vimalux-cashflow-legend { display:flex; gap:18px; margin-top:8px; font-size:11px; color:#52696c; }
    .vimalux-cashflow-legend i { display:inline-block; width:18px; height:3px; margin-right:6px; vertical-align:middle; border-radius:2px; }
    .vimalux-view-cashflow { margin-top:14px; padding:9px 12px; border:1px solid #cad6d8; border-radius:8px; background:#fff; color:#17363a; font-weight:700; cursor:pointer; }
  `;
  doc.head.appendChild(style);
}

function alignBranding() {
  const aside = document.querySelector("aside");
  if (!aside) return;
  const copy = aside.firstElementChild?.children?.[1];
  if (!copy) return;
  copy.classList.add("vimalux-brand-copy");
  const subtitle = copy.querySelector("span");
  if (subtitle && subtitle.textContent?.trim() !== "Intelligence") subtitle.textContent = "Intelligence";
}

function selectedWattFromButton(button) {
  const selected = button.closest("tr")?.querySelector("select")?.selectedOptions?.[0]?.textContent || "";
  const match = selected.match(/(\d+(?:[.,]\d+)?)\s*W/i);
  return match ? `${match[1]}W` : "selected luminaire";
}

function enhanceRecommendationButtons() {
  Array.from(document.querySelectorAll("button"))
    .filter((button) => button.textContent?.trim().startsWith("Apply AI recommendation"))
    .forEach((button) => {
      if (button.dataset.vimaluxEnhanced === "true") return;
      button.dataset.vimaluxEnhanced = "true";
      button.classList.add("vimalux-ai-recommendation-button");
      button.addEventListener("click", () => {
        window.setTimeout(() => {
          button.textContent = `✓ AI recommendation applied · ${selectedWattFromButton(button)}`;
          button.classList.add("is-applied");
          window.setTimeout(() => {
            button.textContent = "Apply AI recommendation";
            button.classList.remove("is-applied");
          }, 2400);
        }, 0);
      });
    });
}

function normalizeLocalizedNumber(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return "0";
  if (raw.includes(",")) return raw.replace(/\./g, "").replace(",", ".");
  return raw;
}

function installLocalizedNumericInputs() {
  if (window.__vimaluxLocalizedInputsInstalled) return;
  window.__vimaluxLocalizedInputsInstalled = true;
  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.inputMode !== "decimal" || input.dataset.vimaluxCommit === "true") return;
    input.dataset.vimaluxRawValue = input.value;
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener("blur", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.inputMode !== "decimal") return;
    const normalized = normalizeLocalizedNumber(input.dataset.vimaluxRawValue ?? input.value);
    input.dataset.vimaluxCommit = "true";
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, normalized);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    delete input.dataset.vimaluxCommit;
    delete input.dataset.vimaluxRawValue;
  }, true);
}

function addThousandsSeparator(integerPart) {
  const sign = integerPart.startsWith("-") ? "-" : "";
  const digits = integerPart.replace(/^-/, "").replace(/\./g, "");
  return `${sign}${digits.length < 4 ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatEuroText(value) {
  return value.replace(/(-?\d{4,})(,\d{1,2})?\s*€/g, (match, integerPart, decimals = "") => `${addThousandsSeparator(integerPart)}${decimals} €`);
}

function applyVisibleNumberFormatting(doc = document) {
  if (!doc.body) return;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest("input, textarea, option, script, style")) return;
    const current = node.nodeValue || "";
    if (!/\d{4,}(?:,\d{1,2})?\s*€/.test(current)) return;
    const formatted = formatEuroText(current);
    if (formatted !== current) node.nodeValue = formatted;
  });
}

function parseLocalizedNumber(value) {
  const cleaned = String(value || "").replace(/€/g, "").replace(/\s/g, "").replace(/−/g, "-").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
}

function findCashflowTable(doc = document) {
  return Array.from(doc.querySelectorAll("table")).find((table) => {
    const headings = Array.from(table.querySelectorAll("th")).map((th) => th.textContent?.trim());
    return (headings.includes("Net cash flow") || headings.includes("Cash flow netto")) && (headings.includes("Accumulated") || headings.includes("Cumulato"));
  });
}

function makePolyline(values, width, height, padding, min, max) {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = padding + (values.length === 1 ? 0 : index * usableWidth / (values.length - 1));
    const y = padding + (max - value) * usableHeight / range;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function restoreCashflowChart(doc = document) {
  const table = findCashflowTable(doc);
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  if (!rows.length) return;
  const data = rows.map((row) => {
    const cells = row.querySelectorAll("td");
    return { year: Number(cells[0]?.textContent) || 0, net: parseLocalizedNumber(cells[5]?.textContent), cumulative: parseLocalizedNumber(cells[6]?.textContent) };
  });
  const signature = JSON.stringify(data);
  let chart = table.parentElement?.querySelector(":scope > .vimalux-cashflow-chart");
  if (chart?.dataset.signature === signature) return;
  chart?.remove();
  const width = 920, height = 260, padding = 34;
  const values = data.flatMap((row) => [row.net, row.cumulative, 0]);
  const min = Math.min(...values), max = Math.max(...values);
  const zeroY = padding + (max * (height - padding * 2)) / (max - min || 1);
  const netPoints = makePolyline(data.map((row) => row.net), width, height, padding, min, max);
  const cumulativePoints = makePolyline(data.map((row) => row.cumulative), width, height, padding, min, max);
  chart = doc.createElement("div");
  chart.className = "vimalux-cashflow-chart";
  chart.dataset.signature = signature;
  chart.innerHTML = `<div class="vimalux-cashflow-chart-head"><b>Customer cash flow</b><span>Annual net cash flow and accumulated benefit</span></div><svg viewBox="0 0 ${width} ${height}"><line x1="${padding}" y1="${zeroY.toFixed(1)}" x2="${width-padding}" y2="${zeroY.toFixed(1)}" stroke="#cbd7d8"/><polyline points="${netPoints}" fill="none" stroke="#6d8790" stroke-width="3"/><polyline points="${cumulativePoints}" fill="none" stroke="#0d2b2f" stroke-width="4"/>${data.map((row,index)=>{if(![0,4,8,9,14,19].includes(index))return "";const x=padding+(data.length===1?0:index*(width-padding*2)/(data.length-1));return `<text x="${x.toFixed(1)}" y="${height-8}" text-anchor="middle" font-size="10" fill="#6e8285">Y${row.year}</text>`;}).join("")}</svg><div class="vimalux-cashflow-legend"><span><i style="background:#6d8790"></i>Net cash flow</span><span><i style="background:#0d2b2f"></i>Accumulated cash flow</span></div>`;
  table.parentElement?.insertBefore(chart, table);
}

function addFinanceCashflowShortcut() {
  const heading = Array.from(document.querySelectorAll("h2")).find((item) => item.textContent?.trim() === "Payment result");
  const card = heading?.closest("section");
  if (!card || card.querySelector(".vimalux-view-cashflow")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vimalux-view-cashflow";
  button.textContent = "View cashflow table & graph";
  button.addEventListener("click", () => Array.from(document.querySelectorAll("aside button")).find((item) => item.textContent?.trim() === "Customer Case")?.click());
  card.appendChild(button);
}

function removeDuplicateEnergyPriceFromPricing() {
  const activeNav = Array.from(document.querySelectorAll("aside button")).find((button) => {
    const background = getComputedStyle(button).backgroundColor;
    return background === "rgb(201, 241, 90)" || button.textContent?.trim() === "Pricing" && button.getAttribute("aria-current") === "page";
  });
  if (activeNav?.textContent?.trim() !== "Pricing") return;
  Array.from(document.querySelectorAll("label")).forEach((label) => {
    const caption = label.querySelector("span")?.textContent?.trim().toLowerCase() || "";
    if (caption.includes("energy price") || caption.includes("electricity price")) label.remove();
  });
}

function enhanceQuotationWindow(win) {
  if (!win) return;
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      const doc = win.document;
      if (doc?.body?.children?.length) {
        installStyles(doc);
        applyVisibleNumberFormatting(doc);
        restoreCashflowChart(doc);
      }
      if (attempts > 20 || win.closed) window.clearInterval(timer);
    } catch (error) {
      if (attempts > 20) window.clearInterval(timer);
    }
  }, 100);
}

function patchWindowOpen() {
  if (window.__vimaluxWindowOpenPatched) return;
  window.__vimaluxWindowOpenPatched = true;
  const originalOpen = window.open.bind(window);
  window.open = (...args) => {
    const child = originalOpen(...args);
    enhanceQuotationWindow(child);
    return child;
  };
}

function applyEnhancements() {
  installStyles();
  alignBranding();
  enhanceRecommendationButtons();
  installLocalizedNumericInputs();
  applyVisibleNumberFormatting();
  restoreCashflowChart();
  addFinanceCashflowShortcut();
  removeDuplicateEnergyPriceFromPricing();
  patchWindowOpen();
}

if (typeof document !== "undefined") {
  applyEnhancements();
  const observer = new MutationObserver(() => window.requestAnimationFrame(applyEnhancements));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
