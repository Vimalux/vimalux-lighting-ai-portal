const TABS_ID = "vimalux-catalogue-tabs";

function findCatalogueSections() {
  const main = document.querySelector("main");
  if (!main) return null;

  const sections = [...main.querySelectorAll(":scope > section.card, section.card")];
  const led = sections.find((section) => /Armature LED e Retrofit|LED luminaires & Retrofit/i.test(section.textContent || ""));
  const smart = sections.find((section) => /Smart Lighting|SMART \/ CMS/i.test(section.textContent || ""));
  if (!led || !smart) return null;
  return { main, led, smart };
}

function applyTab(active, led, smart, buttons) {
  const showLed = active === "led";
  led.style.display = showLed ? "" : "none";
  smart.style.display = showLed ? "none" : "";

  buttons.led.className = showLed ? "primary" : "secondary";
  buttons.smart.className = showLed ? "secondary" : "primary";
  buttons.led.setAttribute("aria-selected", showLed ? "true" : "false");
  buttons.smart.setAttribute("aria-selected", showLed ? "false" : "true");
}

function ensureTabs() {
  const found = findCatalogueSections();
  const existing = document.getElementById(TABS_ID);

  if (!found) {
    existing?.remove();
    return;
  }

  const { led, smart } = found;
  let tabs = existing;
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.id = TABS_ID;
    tabs.setAttribute("role", "tablist");
    tabs.style.display = "flex";
    tabs.style.gap = "8px";
    tabs.style.margin = "0 0 14px";

    const ledButton = document.createElement("button");
    ledButton.type = "button";
    ledButton.textContent = "LUMINAIRES";
    ledButton.setAttribute("role", "tab");
    ledButton.dataset.catalogueTab = "led";

    const smartButton = document.createElement("button");
    smartButton.type = "button";
    smartButton.textContent = "SMART / CMS";
    smartButton.setAttribute("role", "tab");
    smartButton.dataset.catalogueTab = "smart";

    tabs.append(ledButton, smartButton);
    led.parentNode?.insertBefore(tabs, led);

    const buttons = { led: ledButton, smart: smartButton };
    ledButton.addEventListener("click", () => applyTab("led", led, smart, buttons));
    smartButton.addEventListener("click", () => applyTab("smart", led, smart, buttons));
    applyTab("led", led, smart, buttons);
  } else {
    const ledButton = tabs.querySelector('[data-catalogue-tab="led"]');
    const smartButton = tabs.querySelector('[data-catalogue-tab="smart"]');
    if (!ledButton || !smartButton) return;
    const current = smart.style.display !== "none" && led.style.display === "none" ? "smart" : "led";
    applyTab(current, led, smart, { led: ledButton, smart: smartButton });
  }
}

if (typeof window !== "undefined") {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureTabs();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
}
