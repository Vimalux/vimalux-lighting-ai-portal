const STYLE_ID = "vimalux-planner-alignment";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html, body, button, input, select, textarea {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif !important;
    }

    aside .vimalux-brand-copy {
      display: grid !important;
      gap: 1px !important;
      line-height: 1.05 !important;
    }

    aside .vimalux-brand-copy > b {
      font-size: 17px !important;
      letter-spacing: .2px !important;
    }

    aside .vimalux-brand-copy > span {
      display: block !important;
      margin-top: 3px !important;
      color: #9cb0b2 !important;
      font-size: 9px !important;
      font-weight: 600 !important;
      letter-spacing: .75px !important;
      text-transform: uppercase !important;
    }

    .vimalux-ai-recommendation-button {
      width: auto !important;
      min-width: 210px !important;
      margin-top: 7px !important;
      padding: 8px 12px !important;
      border: 1px solid #c9d7d9 !important;
      border-radius: 7px !important;
      background: #ffffff !important;
      color: #17363a !important;
      font-size: 12px !important;
      font-weight: 650 !important;
      cursor: pointer !important;
      transition: background .15s ease, border-color .15s ease, color .15s ease !important;
    }

    .vimalux-ai-recommendation-button:hover {
      background: #f1f7f7 !important;
      border-color: #8da6a9 !important;
    }

    .vimalux-ai-recommendation-button.is-applied {
      background: #eaf8e7 !important;
      border-color: #79ba6b !important;
      color: #17652b !important;
    }
  `;
  document.head.appendChild(style);
}

function alignBranding() {
  const aside = document.querySelector("aside");
  if (!aside) return;
  const brand = aside.firstElementChild;
  const copy = brand?.children?.[1];
  if (!copy) return;
  copy.classList.add("vimalux-brand-copy");
  const subtitle = copy.querySelector("span");
  if (subtitle && subtitle.textContent?.trim() !== "Intelligence") {
    subtitle.textContent = "Intelligence";
  }
}

function selectedWattFromButton(button) {
  const row = button.closest("tr");
  const select = row?.querySelector("select");
  const selected = select?.selectedOptions?.[0]?.textContent || "";
  const match = selected.match(/(\d+(?:[.,]\d+)?)\s*W/i);
  return match ? `${match[1]}W` : "selected luminaire";
}

function enhanceRecommendationButtons() {
  const buttons = Array.from(document.querySelectorAll("button"));
  buttons
    .filter((button) => button.textContent?.trim().startsWith("Apply AI recommendation"))
    .forEach((button) => {
      if (button.dataset.vimaluxEnhanced === "true") return;
      button.dataset.vimaluxEnhanced = "true";
      button.classList.add("vimalux-ai-recommendation-button");
      button.addEventListener("click", () => {
        window.setTimeout(() => {
          const watt = selectedWattFromButton(button);
          button.textContent = `✓ AI recommendation applied · ${watt}`;
          button.classList.add("is-applied");
          window.setTimeout(() => {
            button.textContent = "Apply AI recommendation";
            button.classList.remove("is-applied");
          }, 2400);
        }, 0);
      });
    });
}

function applyEnhancements() {
  installStyles();
  alignBranding();
  enhanceRecommendationButtons();
}

if (typeof document !== "undefined") {
  applyEnhancements();
  const observer = new MutationObserver(applyEnhancements);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
