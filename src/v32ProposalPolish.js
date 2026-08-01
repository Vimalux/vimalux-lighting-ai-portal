const STYLE_ID = "vimalux-proposal-polish";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vimalux-proposal-intro { margin: 2px 0 18px; color:#64777a; font-size:14px; }
    .vimalux-proposal-grid { display:grid; grid-template-columns:repeat(3,minmax(180px,1fr)); gap:12px; margin:18px 0 20px; }
    .vimalux-proposal-item { padding:15px; border:1px solid #dfe8e9; border-radius:11px; background:#f9fbfb; }
    .vimalux-proposal-item b { display:block; margin-bottom:4px; color:#12373b; font-size:14px; }
    .vimalux-proposal-item span { color:#687d80; font-size:12px; line-height:1.35; }
    .vimalux-proposal-actions { display:flex; align-items:end; justify-content:space-between; gap:20px; margin-top:12px; padding-top:18px; border-top:1px solid #e5ecec; }
    .vimalux-proposal-note { max-width:620px; color:#637679; font-size:12px; line-height:1.5; }
    @media (max-width:1100px){ .vimalux-proposal-grid{grid-template-columns:1fr 1fr;} }
  `;
  document.head.appendChild(style);
}

function fixBrandSpacing() {
  const aside = document.querySelector("aside");
  const brand = aside?.firstElementChild;
  if (!brand) return;
  const span = brand.querySelector("span");
  if (!span) return;
  const textNode = Array.from(brand.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode && textNode.nodeValue?.trim() === "VIMALUX") textNode.nodeValue = "VIMALUX ";
}

function isProposalActive() {
  const buttons = Array.from(document.querySelectorAll("aside button"));
  const active = buttons.find((button) => getComputedStyle(button).backgroundColor === "rgb(201, 241, 90)");
  return active?.textContent?.trim() === "Proposal";
}

function removeDuplicateProposalAction() {
  const header = document.querySelector("main > header");
  const headerButton = header?.querySelector("button");
  if (!headerButton) return;
  if (isProposalActive()) {
    headerButton.style.display = "none";
  } else {
    headerButton.style.display = "";
    headerButton.textContent = "Generate proposal";
  }
}

function enhanceProposalWorkspace() {
  if (!isProposalActive()) return;
  const heading = Array.from(document.querySelectorAll("main h2")).find((node) => node.textContent?.trim() === "Proposal");
  const card = heading?.closest("section");
  if (!card || card.querySelector(".vimalux-proposal-grid")) return;

  const intro = document.createElement("p");
  intro.className = "vimalux-proposal-intro";
  intro.textContent = "Customer-ready proposal generated from the active project, selected solution, pricing, finance and ROI engine.";
  heading.insertAdjacentElement("afterend", intro);

  const grid = document.createElement("div");
  grid.className = "vimalux-proposal-grid";
  grid.innerHTML = `
    <div class="vimalux-proposal-item"><b>Executive summary</b><span>Project scope, investment, annual benefit and key decision metrics.</span></div>
    <div class="vimalux-proposal-item"><b>Technical solution</b><span>Selected luminaires, Smart Lighting, CMS and PowerAiD configuration.</span></div>
    <div class="vimalux-proposal-item"><b>CAPEX & OPEX</b><span>Investment lines, annual services and recurring platform costs.</span></div>
    <div class="vimalux-proposal-item"><b>Energy & CO₂</b><span>Baseline, final consumption, total reduction and avoided emissions.</span></div>
    <div class="vimalux-proposal-item"><b>Finance & ROI</b><span>Payment model, payback, NPV and lifecycle result.</span></div>
    <div class="vimalux-proposal-item"><b>Cash flow</b><span>Annual and cumulative customer cash flow for the selected period.</span></div>`;

  const existingGrid = card.querySelector(":scope > div");
  if (existingGrid) existingGrid.insertAdjacentElement("afterend", grid);
  else card.appendChild(grid);

  const button = Array.from(card.querySelectorAll("button")).find((node) => /Generate/i.test(node.textContent || ""));
  if (button) {
    button.textContent = "Generate customer proposal";
    const actions = document.createElement("div");
    actions.className = "vimalux-proposal-actions";
    const note = document.createElement("div");
    note.className = "vimalux-proposal-note";
    note.textContent = "This is the only proposal-generation action. “Quotation” and “Proposal” are now treated as the same customer document.";
    button.parentElement?.insertBefore(actions, button);
    actions.appendChild(note);
    actions.appendChild(button);
  }
}

function apply() {
  installStyles();
  fixBrandSpacing();
  removeDuplicateProposalAction();
  enhanceProposalWorkspace();
}

if (typeof document !== "undefined") {
  apply();
  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
}
