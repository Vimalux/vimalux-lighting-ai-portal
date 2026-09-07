const HYBRID_MARKER = '[data-vimalux-report-hybrid="summary"]';

function placeDetailedHybridSection() {
  const report = document.querySelector(".report-preview");
  if (!report) return;
  const hybrid = report.querySelector(HYBRID_MARKER);
  const chart = report.querySelector(".customer-value-chart");
  if (!hybrid || !chart) return;

  const chartCard = chart.closest(".card") || chart;
  if (chartCard.nextElementSibling === hybrid) return;
  chartCard.insertAdjacentElement("afterend", hybrid);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    placeDetailedHybridSection();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("focus", schedule);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true });
  schedule();
}
