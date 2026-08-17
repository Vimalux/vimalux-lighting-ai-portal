import React, { useEffect, useMemo, useState } from "react";
import { calculateBusinessCase, numberValue } from "./calculations.js";
import { defaultProject, loadProjects, migrateProject, uid } from "./model.js";
import { formatMoney, formatNumber, formatPercent, useT } from "./i18n.js";
import { generateCustomerPdf } from "./report.js";
import {
  crmMetrics,
  formatProbabilityPoints,
  pipelineStageTotals,
  pipelineTotals,
} from "./crm.js";
import { growthForecast, partnerTotals } from "./partners.js";
import { generatePartnerPdf } from "./partnerReport.js";
import {
  buildImportedGroups,
  detectWorkbookType,
  guessLightingMapping,
  parseNoleggioWorkbook,
  parsePlannerWorkbook,
  readLightingWorkbook,
} from "./lightingImport.js";
import {
  deleteCloudProject,
  loadCloudState,
  saveCloudState,
  supabase,
  supabaseConfigured,
} from "./supabase.js";
import "./styles.css";
import "./business-case.css";
import "./disabled-fields.css";
import "./auth.css";
import "./import.css";
import "./importMode.css";
import "./bulk.css";

const workflow = [
  ["customer", "customer"],
  ["existing", "existing"],
  ["solution", "solution"],
  ["pricing", "pricing"],
  ["assumptions", "assumptions"],
  ["business", "business"],
  ["report", "report"],
];
const RATE_PROFILES = [
  { id: "municipality", label: "Municipality / Comune", annualRate: 4.8 },
  { id: "standard_eur", label: "Standard EUR", annualRate: 5.5 },
  { id: "noleggio", label: "Noleggio Operativo", annualRate: 6.2 },
  { id: "custom", label: "Custom / Manuale", annualRate: null },
];
const numeric = new Set([
  "quantity",
  "existingWattage",
  "existingSystemFactor",
  "existingDimmingPercent",
  "existingFullPowerHours",
  "existingReducedHours",
  "existingReducedLoadPercent",
  "wattage",
  "lumen",
  "costPrice",
  "salesPrice",
  "implementationCost",
  "implementationSalesPrice",
  "annualCost",
  "annualSalesPrice",
  "gatewayQuantity",
  "antennaQuantity",
  "meterQuantity",
  "operatingHours",
  "energyPrice",
  "sapFactor",
  "mhFactor",
  "mercuryFactor",
  "co2KgPerKwh",
  "cloPercent",
  "powerAidPercent",
  "powerAidCustomerFeePercent",
  "powerAidSupplierSharePercent",
  "existingMaintenance",
  "newMaintenance",
  "serviceAgreementPeriod",
  "financingPeriod",
  "interestRate",
  "allInclusiveAnnualPayment",
  "upfrontPayment",
  "energyEscalation",
  "opexEscalation",
  "discountRate",
  "analysisPeriod",
  "freightCostPerLamp",
  "freightSalesPerLamp",
  "commissionPercent",
  "agent1CommissionPercent",
  "agent2CommissionPercent",
  "dutyCost",
  "warrantyReservePercent",
  "fundingCostPercent",
  "otherDirectCosts",
  "minimumMarginPercent",
  "closingProbability",
  "totalContractValue",
]);

export default function App() {
  const hadStoredProjects = useMemo(
    () => Boolean(localStorage.getItem("vimalux-intelligence-projects")),
    [],
  );
  const initial = useMemo(loadProjects, []);
  const [projects, setProjects] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0].id);
  const [view, setView] = useState("customer");
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [cloudReady, setCloudReady] = useState(!supabaseConfigured);
  const [syncState, setSyncState] = useState(
    supabaseConfigured ? "connecting" : "local",
  );
  const [syncError, setSyncError] = useState("");
  const project = projects.find((p) => p.id === activeId) || projects[0];
  const t = useT(project.language);
  const result = useMemo(() => calculateBusinessCase(project), [project]);
  useEffect(
    () =>
      localStorage.setItem(
        "vimalux-intelligence-projects",
        JSON.stringify(projects),
      ),
    [projects],
  );
  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
      if (!next) setCloudReady(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabaseConfigured || !session) return;
    let active = true;
    setSyncState("loading");
    loadCloudState(initial, hadStoredProjects)
      .then((rows) => {
        if (!active) return;
        const migrated = rows.map(migrateProject);
        setProjects(migrated);
        setActiveId((current) =>
          migrated.some((p) => p.id === current) ? current : migrated[0].id,
        );
        setCloudReady(true);
        setSyncState("saved");
      })
      .catch((error) => {
        if (!active) return;
        setSyncError(error.message);
        setSyncState("error");
      });
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => {
    if (!supabaseConfigured || !session || !cloudReady) return;
    setSyncState("saving");
    const timer = setTimeout(
      () =>
        saveCloudState(projects)
          .then(() => {
            setSyncState("saved");
            setSyncError("");
          })
          .catch((error) => {
            setSyncState("error");
            setSyncError(error.message);
          }),
      800,
    );
    return () => clearTimeout(timer);
  }, [projects, session, cloudReady]);
  const update = (path, value) =>
    setProjects((all) => {
      const normalized = numeric.has(path.at(-1)) ? numberValue(value) : value;
      const changedAt = new Date().toISOString();
      if (path[0] === "catalogue") {
        const catalogue = setPath(project, path, normalized).catalogue;
        return all.map((p) =>
          migrateProject({ ...p, catalogue, updatedAt: changedAt }),
        );
      }
      return all.map((p) => {
        if (p.id !== project.id) return p;
        let next = setPath({ ...p, updatedAt: changedAt }, path, normalized);
        if (path[0] === "crm" && path[1] === "status" && normalized === "won")
          next = setPath(next, ["crm", "closingProbability"], 100);
        if (path[0] === "assumptions" && path[1] === "rateProfileId") {
          const profile = RATE_PROFILES.find((item) => item.id === normalized);
          if (profile?.annualRate != null)
            next = setPath(
              next,
              ["assumptions", "interestRate"],
              profile.annualRate,
            );
          next = setPath(next, ["assumptions", "interestRateSnapshot"], {
            profileId: normalized,
            annualRate:
              profile?.annualRate ?? numberValue(next.assumptions.interestRate),
            capturedAt: changedAt,
          });
        }
        if (path[0] === "assumptions" && path[1] === "interestRate")
          next = setPath(next, ["assumptions", "interestRateSnapshot"], {
            profileId: "custom",
            annualRate: normalized,
            capturedAt: changedAt,
          });
        return next;
      });
    });
  const money = (v) =>
    formatMoney(v, project.language, project.project.currency);
  const num = (v, d = 0) => formatNumber(v, project.language, d);
  const create = () => {
    const p = defaultProject();
    setProjects((x) => [...x, p]);
    setActiveId(p.id);
    setView("customer");
  };
  const removeProject = async (id) => {
    const target = projects.find((item) => item.id === id);
    if (!target) return;
    const label = target.project?.name || target.name || "project";
    const message =
      project.language === "it"
        ? `Eliminare definitivamente il progetto "${label}"?`
        : `Delete project "${label}" permanently?`;
    if (!confirm(message)) return;
    if (supabaseConfigured && session && cloudReady) {
      try {
        setSyncState("saving");
        await deleteCloudProject(id);
        setSyncState("saved");
        setSyncError("");
      } catch (error) {
        setSyncState("error");
        setSyncError(error.message);
        alert(
          project.language === "it"
            ? `Impossibile eliminare il progetto dal cloud: ${error.message}`
            : `The project could not be deleted from the cloud: ${error.message}`,
        );
        return;
      }
    }
    const remaining = projects.filter((item) => item.id !== id);
    const next = remaining.length ? remaining : [defaultProject()];
    setProjects(next);
    if (id === activeId) setActiveId(next[0].id);
    setView("projects");
  };
  const importProjectFile = async (file) => {
    if (!file) return;
    try {
      const sheets = await readLightingWorkbook(file);
      const type = detectWorkbookType(sheets);
      const p = defaultProject();
      if (type === "noleggio") {
        const imported = parseNoleggioWorkbook(sheets);
        const warning = imported.warnings.length
          ? `\n\nWarnings:\n- ${imported.warnings.join("\n- ")}`
          : "";
        const preview = `${imported.projectName}\nOfficial CAPEX: € ${imported.capex.toLocaleString(undefined, { maximumFractionDigits: 2 })}\nAll-inclusive/year: € ${imported.allInclusiveAnnualPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nPayment period: ${imported.financingYears} years\nInterest: ${imported.interestRate}%\nTotal project payments: € ${imported.totalCustomerPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${warning}\n\nImport as a new Noleggio Operativo project?`;
        if (!confirm(preview)) return;
        p.customer.name = imported.customerName;
        p.project.name = imported.projectName;
        p.name = imported.projectName;
        if (imported.quotationId)
          p.project.businessCaseId = imported.quotationId;
        p.groups = [
          {
            ...p.groups[0],
            name: "Imported luminaires",
            quantity: imported.lamps,
          },
        ];
        p.assumptions = {
          ...p.assumptions,
          dealType: "noleggio_operativo",
          financingModel: "laas",
          contractYears: imported.contractYears,
          financingYears: imported.financingYears,
          interestRate: imported.interestRate,
          rateProfileId: "custom",
          interestRateSnapshot: {
            profileId: "custom",
            annualRate: imported.interestRate,
            capturedAt: new Date().toISOString(),
          },
          allInclusiveAnnualPayment: imported.allInclusiveAnnualPayment,
          officialOfferCapex: imported.capex,
          officialAnnualOpex: imported.annualOpex,
        };
        p.crm = {
          ...p.crm,
          status: "proposal",
          closingProbability: 25,
          totalContractValue: null,
        };
        p.importedCommercial = {
          ...imported,
          fileName: file.name,
          importedAt: new Date().toISOString(),
        };
        p.updatedAt = new Date().toISOString();
        const migrated = migrateProject(p);
        setProjects((all) => [...all, migrated]);
        setActiveId(migrated.id);
        setView("assumptions");
        return;
      }
      if (type === "planner") {
        const imported = parsePlannerWorkbook(
          sheets,
          p.catalogue.led,
          file.name,
        );
        const mix = imported.productMix
          .map((item) => `${item.code}: ${item.quantity}`)
          .join("\n");
        const warning = imported.warnings.length
          ? `\n\nWarnings:\n- ${imported.warnings.join("\n- ")}`
          : "";
        if (
          !confirm(
            `${imported.projectName}\nPlanner technical project\nLuminaires: ${imported.totalQuantity}\n\nProduct mix:\n${mix}${warning}\n\nImport and continue with pricing?`,
          )
        )
          return;
        p.customer.name = imported.customerName;
        p.project.name = imported.projectName;
        p.name = imported.projectName;
        p.groups = imported.groups;
        p.crm = {
          ...p.crm,
          status: "lead",
          closingProbability: 25,
          totalContractValue: null,
        };
        p.importedTechnical = {
          ...imported,
          fileName: file.name,
          importedAt: new Date().toISOString(),
        };
        p.updatedAt = new Date().toISOString();
        const migrated = migrateProject(p);
        setProjects((all) => [...all, migrated]);
        setActiveId(migrated.id);
        setView("existing");
        return;
      }
      const sheet = sheets[0];
      const mapping = guessLightingMapping(sheet.headers);
      if (mapping.wattage === "")
        throw new Error(
          "Could not identify a wattage column. Use the import mapping under Existing Lighting.",
        );
      const imported = buildImportedGroups(
        sheet.rows,
        mapping,
        p.catalogue.led,
        p.language,
      );
      if (!imported.groups.length)
        throw new Error("No valid luminaires were found.");
      if (
        !confirm(
          `${file.name}\nGeneric lighting file\n${imported.message}\n\nImport as a new project?`,
        )
      )
        return;
      p.project.name = file.name.replace(/\.(xlsx?|csv)$/i, "");
      p.name = p.project.name;
      p.groups = imported.groups;
      p.importedTechnical = {
        type: "lighting",
        source: sheet.name,
        fileName: file.name,
        totalQuantity: imported.totalQuantity,
        importedAt: new Date().toISOString(),
      };
      const migrated = migrateProject(p);
      setProjects((all) => [...all, migrated]);
      setActiveId(migrated.id);
      setView("existing");
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  };

  const reset = () => {
    if (
      confirm(
        project.language === "it"
          ? "Eliminare tutti i dati locali e ripristinare i valori iniziali?"
          : "Delete all local data and restore defaults?",
      )
    ) {
      const p = defaultProject();
      localStorage.removeItem("vimalux-intelligence-projects");
      setProjects([p]);
      setActiveId(p.id);
      setView("customer");
    }
  };
  if (!authReady)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <strong>VIMALUX Intelligence</strong>
          <p>Connessione a Supabase…</p>
        </div>
      </div>
    );
  if (supabaseConfigured && !session) return <AuthScreen />;
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span>V</span>
          <div>
            <strong>VIMALUX</strong>
            <small>Intelligence v1.0</small>
          </div>
        </div>
        <nav>
          {workflow.map(([id, key], i) => (
            <button
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
              key={id}
            >
              <b>{i + 1}</b>
              {t(key)}
            </button>
          ))}
        </nav>
        <hr />
        <button
          className={view === "crm" ? "active" : ""}
          onClick={() => setView("crm")}
        >
          CRM
        </button>
        <button
          className={view === "datek" ? "active" : ""}
          onClick={() => setView("datek")}
        >
          DATEK
        </button>
        <button
          className={view === "partnerReports" ? "active" : ""}
          onClick={() => setView("partnerReports")}
        >
          Partner reports
        </button>
        <button
          className={view === "projects" ? "active" : ""}
          onClick={() => setView("projects")}
        >
          {t("projects")}
        </button>
        <button
          className={view === "catalogue" ? "active" : ""}
          onClick={() => setView("catalogue")}
        >
          {t("catalogue")}
        </button>
        <button
          className={view === "admin" ? "active" : ""}
          onClick={() => setView("admin")}
        >
          {t("priceAdmin")}
        </button>
        <button
          className={view === "internalReport" ? "active" : ""}
          onClick={() => setView("internalReport")}
        >
          {t("internalReport")}
        </button>
        {supabaseConfigured && (
          <button className="signout" onClick={() => supabase.auth.signOut()}>
            Esci / Sign out
          </button>
        )}
      </aside>
      <main>
        <header>
          <div>
            <small>{project.project.businessCaseId}</small>
            <h1>
              {t(
                view === "admin"
                  ? "priceAdmin"
                  : workflow.find((x) => x[0] === view)?.[1] || view,
              )}
            </h1>
          </div>
          <div className="header-actions">
            <span className={`saved ${syncState}`}>
              ●{" "}
              {syncState === "saving"
                ? "Salvataggio…"
                : syncState === "error"
                  ? "Errore sincronizzazione"
                  : syncState === "local"
                    ? t("save")
                    : "Supabase sincronizzato"}
            </span>
            <select
              value={project.language}
              onChange={(e) => update(["language"], e.target.value)}
              aria-label="Language"
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
              <option value="da">Dansk</option>
            </select>
          </div>
        </header>
        {syncError && <div className="sync-error">{syncError}</div>}
        {view === "customer" && <Customer p={project} update={update} />}{" "}
        {view === "existing" && <Existing p={project} update={update} t={t} />}{" "}
        {view === "solution" && (
          <Solution
            p={project}
            r={result}
            update={update}
            t={t}
            money={money}
            num={num}
          />
        )}{" "}
        {view === "pricing" && (
          <Pricing p={project} r={result} update={update} t={t} money={money} />
        )}{" "}
        {view === "assumptions" && <Assumptions p={project} r={result} update={update} />}{" "}
        {view === "business" && (
          <Business p={project} r={result} t={t} money={money} num={num} />
        )}{" "}
        {view === "report" && (
          <Report p={project} r={result} t={t} money={money} num={num} />
        )}{" "}
        {view === "internalReport" && (
          <InternalReport
            p={project}
            r={result}
            update={update}
            money={money}
          />
        )}{" "}
        {view === "crm" && (
          <Crm
            projects={projects}
            active={project}
            update={update}
            money={money}
          />
        )}{" "}
        {view === "datek" && (
          <DatekDashboard projects={projects} money={money} />
        )}{" "}
        {view === "partnerReports" && (
          <PartnerReports projects={projects} p={project} money={money} />
        )}{" "}
        {view === "projects" && (
          <Projects
            list={projects}
            activeId={activeId}
            select={(id) => {
              setActiveId(id);
              setView("customer");
            }}
            remove={removeProject}
            create={create}
            importProjectFile={importProjectFile}
            t={t}
          />
        )}{" "}
        {view === "catalogue" && <Catalogue p={project} update={update} />}{" "}
        {view === "admin" && (
          <Admin p={project} r={result} setView={setView} reset={reset} t={t} />
        )}{" "}
      </main>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setMessage(error.message);
    setBusy(false);
  };
  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">V</div>
        <h1>VIMALUX Intelligence</h1>
        <p>
          Accedi con l’account Supabase autorizzato.
          <br />
          Sign in with your authorised Supabase account.
        </p>
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
        />
        {message && <div className="sync-error">{message}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "Accesso…" : "Accedi / Sign in"}
        </button>
      </form>
    </div>
  );
}

function setPath(object, path, value) {
  const copy = structuredClone(object);
  let cursor = copy;
  path.slice(0, -1).forEach((k) => (cursor = cursor[k]));
  cursor[path.at(-1)] = value;
  return migrateProject(copy);
}
function NumericInput({ value, onChange, placeholder, disabled = false }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  return (
    <input
      inputMode="decimal"
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onChange(draft)}
    />
  );
}
const Field = ({ label, value, onChange, type = "text", children, disabled = false }) => (
  <label className={disabled ? "field-disabled" : ""}>
    <span>{label}</span>
    {children ? (
      <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    ) : typeof value === "number" ? (
      <NumericInput disabled={disabled} value={value} onChange={onChange} />
    ) : (
      <input
        type={type}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </label>
);
const Toggle = ({ label, value, onChange, disabled = false, title = "" }) => (
  <label className={`toggle ${disabled ? "field-disabled" : ""}`} title={title}>
    <input
      type="checkbox"
      checked={Boolean(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span>{label}</span>
  </label>
);
const Card = ({ title, children, className = "" }) => (
  <section className={`card ${className}`.trim()}>
    <h2>{title}</h2>
    {children}
  </section>
);

function Customer({ p, update }) {
  const c = [
    [
      "name",
      p.language === "it" ? "Comune / cliente" : "Municipality / customer",
    ],
    ["province", p.language === "it" ? "Provincia" : "Province"],
    ["region", p.language === "it" ? "Regione" : "Region"],
    ["country", p.language === "it" ? "Paese" : "Country"],
    ["contact", p.language === "it" ? "Referente" : "Contact person"],
    ["title", p.language === "it" ? "Ruolo" : "Position / title"],
    ["email", "Email"],
    ["telephone", p.language === "it" ? "Telefono" : "Telephone"],
  ];
  const q = [
    ["name", p.language === "it" ? "Nome progetto" : "Project name"],
    ["businessCaseId", "Business Case ID"],
    [
      "consultant",
      p.language === "it" ? "Consulente commerciale" : "Sales consultant",
    ],
    ["date", p.language === "it" ? "Data" : "Date"],
    ["currency", p.language === "it" ? "Valuta" : "Currency"],
  ];
  return (
    <div className="two-col">
      <Card title={p.language === "it" ? "Cliente" : "Customer"}>
        <div className="form-grid">
          {c.map(([k, l]) => (
            <Field
              key={k}
              label={l}
              value={p.customer[k]}
              onChange={(v) => update(["customer", k], v)}
            />
          ))}
        </div>
      </Card>
      <Card title={p.language === "it" ? "Progetto" : "Project"}>
        <div className="form-grid">
          {q.map(([k, l]) => (
            <Field
              key={k}
              label={l}
              type={k === "date" ? "date" : "text"}
              value={p.project[k]}
              onChange={(v) => update(["project", k], v)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
function Existing({ p, update, t }) {
  const [importer, setImporter] = useState(null);
  const [importError, setImportError] = useState("");
  const [filterTechnology, setFilterTechnology] = useState("ALL");
  const [filterWattage, setFilterWattage] = useState("ALL");
  const [bulkProduct, setBulkProduct] = useState("");
  const add = () =>
    update(
      ["groups"],
      [
        ...p.groups,
        {
          id: uid(),
          name: `${p.language === "it" ? "Gruppo" : "Group"} ${p.groups.length + 1}`,
          quantity: 0,
          technology: "SAP",
          existingWattage: 0,
          upgradeSelected: true,
          proposedProductId: p.catalogue.led[0]?.id || "",
          smartAssigned: true,
          powerAidAssigned: true,
        },
      ],
    );
  const remove = (id) =>
    update(
      ["groups"],
      p.groups.filter((g) => g.id !== id),
    );
  const matchesFilter = (g) =>
    (filterTechnology === "ALL" || g.technology === filterTechnology) &&
    (filterWattage === "ALL" || String(g.existingWattage) === filterWattage);
  const visibleGroups = p.groups
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => matchesFilter(g));
  const wattages = [
    ...new Set(
      p.groups
        .filter(
          (g) =>
            filterTechnology === "ALL" || g.technology === filterTechnology,
        )
        .map((g) => String(g.existingWattage)),
    ),
  ].sort((a, b) => Number(a) - Number(b));
  const applyProduct = () => {
    if (!bulkProduct || !visibleGroups.length) return;
    update(
      ["groups"],
      p.groups.map((group) =>
        matchesFilter(group)
          ? { ...group, proposedProductId: bulkProduct }
          : group,
      ),
    );
  };
  const setUpgradeForVisible = (upgradeSelected) => {
    if (!visibleGroups.length) return;
    update(
      ["groups"],
      p.groups.map((group) => matchesFilter(group) ? { ...group, upgradeSelected } : group),
    );
  };
  const openFile = async (file) => {
    if (!file) return;
    setImportError("");
    try {
      const sheets = await readLightingWorkbook(file);
      const first = sheets.findIndex((sheet) => sheet.headers.length);
      if (first < 0)
        throw new Error(
          p.language === "it"
            ? "Il file non contiene dati."
            : "The file contains no data.",
        );
      setImporter({
        fileName: file.name,
        sheets,
        sheetIndex: first,
        mode: "individual",
        mapping: guessLightingMapping(sheets[first].headers),
      });
    } catch (error) {
      setImportError(error.message);
    }
  };
  return (
    <>
      <Card title={t("existing")}>
        <div className="import-actions">
          <label className="file-button">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => openFile(e.target.files?.[0])}
            />
            {p.language === "it" ? "Importa Excel / CSV" : "Import Excel / CSV"}
          </label>
          <span>
            {p.language === "it"
              ? "Mappa le colonne di tipo lampada, potenza e quantità."
              : "Map lamp type, wattage and quantity columns."}
          </span>
        </div>
        {importError && <div className="sync-error">{importError}</div>}
        <div className="bulk-panel">
          <h3>
            {p.language === "it"
              ? "Assegnazione massiva prodotto LED"
              : "Bulk LED product assignment"}
          </h3>
          <div className="bulk-controls">
            <Field
              label={
                p.language === "it" ? "Filtra tecnologia" : "Filter technology"
              }
              value={filterTechnology}
              onChange={(value) => {
                setFilterTechnology(value);
                setFilterWattage("ALL");
              }}
            >
              <option value="ALL">
                {p.language === "it" ? "Tutte" : "All"}
              </option>
              {[
                ["SAP", "SAP / HPS"],
                ["MH", "MH"],
                ["MERCURY", "Mercury / HQL"],
                ["LED", "Existing LED"],
                ["OTHER", "Other"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Field>
            <Field
              label={p.language === "it" ? "Filtra potenza" : "Filter wattage"}
              value={filterWattage}
              onChange={setFilterWattage}
            >
              <option value="ALL">
                {p.language === "it" ? "Tutte" : "All"}
              </option>
              {wattages.map((value) => (
                <option key={value} value={value}>
                  {value} W
                </option>
              ))}
            </Field>
            <Field
              label={
                p.language === "it" ? "Nuovo prodotto LED" : "New LED product"
              }
              value={bulkProduct}
              onChange={setBulkProduct}
            >
              <option value="">-</option>
              {p.catalogue.led
                .filter((product) => product.active)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.brand} {product.name} · {product.wattage} W
                  </option>
                ))}
            </Field>
            <button
              className="primary"
              disabled={!bulkProduct || !visibleGroups.length}
              onClick={applyProduct}
            >
              {p.language === "it"
                ? "Applica a tutti i risultati"
                : "Apply to all results"}
            </button>
          </div>
          <div className="bulk-result">
            <span>
              {visibleGroups.length} / {p.groups.length}{" "}
              {p.language === "it" ? "righe visualizzate" : "rows shown"}
            </span>
            {(filterTechnology !== "ALL" || filterWattage !== "ALL") && (
              <button
                onClick={() => {
                  setFilterTechnology("ALL");
                  setFilterWattage("ALL");
                }}
              >
                {p.language === "it" ? "Cancella filtri" : "Clear filters"}
              </button>
            )}
            <div className="bulk-selection-actions">
              <button className="primary" onClick={() => setUpgradeForVisible(true)}>
                {p.language === "it" ? "Seleziona risultati" : "Select results"}
              </button>
              <button onClick={() => setUpgradeForVisible(false)}>
                {p.language === "it" ? "Escludi risultati" : "Exclude results"}
              </button>
            </div>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  p.language === "it" ? "Gruppo" : "Group",
                  p.language === "it" ? "Quantità" : "Quantity",
                  p.language === "it" ? "Tecnologia" : "Technology",
                  p.language === "it"
                    ? "Potenza esistente"
                    : "Existing wattage",
                  p.language === "it" ? "Da sostituire" : "Upgrade",
                  p.language === "it" ? "Prodotto LED" : "Proposed LED",
                  "Smart Lighting",
                  "PowerAiD",
                  "",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map(({ g, i }) => (
                <tr key={g.id}>
                  <td>
                    <input
                      value={g.name}
                      onChange={(e) =>
                        update(["groups", i, "name"], e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <NumericInput
                      value={g.quantity}
                      onChange={(v) => update(["groups", i, "quantity"], v)}
                    />
                  </td>
                  <td>
                    <select
                      value={g.technology}
                      onChange={(e) =>
                        update(["groups", i, "technology"], e.target.value)
                      }
                    >
                      {[
                        ["SAP", "SAP / HPS"],
                        ["MH", "MH"],
                        ["MERCURY", "Mercury / HQL"],
                        ["LED", "Existing LED"],
                        ["OTHER", "Other"],
                      ].map((x) => (
                        <option value={x[0]} key={x[0]}>
                          {x[1]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <NumericInput
                      value={g.existingWattage}
                      onChange={(v) =>
                        update(["groups", i, "existingWattage"], v)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={g.upgradeSelected !== false}
                      onChange={(e) => update(["groups", i, "upgradeSelected"], e.target.checked)}
                    />
                  </td>
                  <td>
                    <select
                      value={g.proposedProductId}
                      disabled={g.upgradeSelected === false}
                      onChange={(e) =>
                        update(
                          ["groups", i, "proposedProductId"],
                          e.target.value,
                        )
                      }
                    >
                      {p.catalogue.led
                        .filter((x) => x.active)
                        .map((x) => (
                          <option value={x.id} key={x.id}>
                            {x.brand} {x.name} · {x.wattage} W
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={g.smartAssigned}
                      disabled={g.upgradeSelected === false}
                      onChange={(e) =>
                        update(["groups", i, "smartAssigned"], e.target.checked)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={g.powerAidAssigned}
                      disabled={g.upgradeSelected === false || !p.solution.powerAidEnabled}
                      title={
                        p.solution.powerAidEnabled
                          ? "PowerAiD assigned to this group"
                          : p.language === "it"
                            ? "Attivare PowerAiD in Soluzione per abilitare l'assegnazione al gruppo"
                            : "Enable PowerAiD under Solution to activate group assignment"
                      }
                      onChange={(e) =>
                        update(
                          ["groups", i, "powerAidAssigned"],
                          e.target.checked,
                        )
                      }
                    />
                  </td>
                  <td>
                    <button className="danger" onClick={() => remove(g.id)}>
                      {t("remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="primary" onClick={add}>
          + {t("add")}
        </button>
        <p className="hint">
          SAP / HPS: {p.assumptions.sapFactor}× · MH: {p.assumptions.mhFactor}×
          · Mercury / HQL: {p.assumptions.mercuryFactor}×
        </p>
      </Card>
      {importer && (
        <LightingImportModal
          p={p}
          state={importer}
          setState={setImporter}
          close={() => setImporter(null)}
          apply={(groups, mode) => {
            update(
              ["groups"],
              mode === "append" ? [...p.groups, ...groups] : groups,
            );
            setImporter(null);
          }}
        />
      )}
    </>
  );
}

function LightingImportModal({ p, state, setState, close, apply }) {
  const sheet = state.sheets[state.sheetIndex];
  const setMapping = (field, value) =>
    setState({ ...state, mapping: { ...state.mapping, [field]: value } });
  const preview =
    state.mapping.wattage === ""
      ? null
      : buildImportedGroups(
          sheet.rows,
          state.mapping,
          p.catalogue.led,
          p.language,
          state.mode,
        );
  const labels =
    p.language === "it"
      ? {
          title: "Importa illuminazione esistente",
          sheet: "Foglio",
          type: "Tipo lampada",
          watt: "Potenza (W)",
          qty: "Quantità (opzionale)",
          name: "Via / posizione (opzionale)",
          asset: "ID lampada / palo (opzionale)",
          skip: "- Ignora -",
          replace: "Sostituisci righe",
          append: "Aggiungi righe",
          cancel: "Annulla",
          individual: "Una riga per lampada",
          grouped: "Raggruppa tipo e potenza",
        }
      : {
          title: "Import existing lighting",
          sheet: "Sheet",
          type: "Lamp type",
          watt: "Wattage (W)",
          qty: "Quantity (optional)",
          name: "Street / location (optional)",
          asset: "Luminaire / pole ID (optional)",
          skip: "- Skip -",
          replace: "Replace rows",
          append: "Append rows",
          cancel: "Cancel",
          individual: "One row per luminaire",
          grouped: "Group by type and wattage",
        };
  const mappingField = (field, label, required = false) => (
    <label>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={state.mapping[field]}
        onChange={(e) => setMapping(field, e.target.value)}
      >
        <option value="">{labels.skip}</option>
        {sheet.headers.map((header, index) => (
          <option key={`${header}-${index}`} value={index}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="import-modal">
        <div className="modal-head">
          <div>
            <h2>{labels.title}</h2>
            <p>
              {state.fileName} · {sheet.rows.length}{" "}
              {p.language === "it" ? "righe" : "rows"} · {sheet.headers.length}{" "}
              {p.language === "it" ? "colonne" : "columns"}
            </p>
          </div>
          <button onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        {state.sheets.length > 1 && (
          <Field
            label={labels.sheet}
            value={state.sheetIndex}
            onChange={(value) => {
              const index = Number(value);
              setState({
                ...state,
                sheetIndex: index,
                mapping: guessLightingMapping(state.sheets[index].headers),
              });
            }}
          >
            {state.sheets.map((item, index) => (
              <option key={item.name} value={index}>
                {item.name}
              </option>
            ))}
          </Field>
        )}
        <div className="import-mode">
          <label>
            <input
              type="radio"
              checked={state.mode === "individual"}
              onChange={() => setState({ ...state, mode: "individual" })}
            />
            <span>{labels.individual}</span>
          </label>
          <label>
            <input
              type="radio"
              checked={state.mode === "grouped"}
              onChange={() => setState({ ...state, mode: "grouped" })}
            />
            <span>{labels.grouped}</span>
          </label>
        </div>
        <div className="mapping-grid">
          {mappingField("assetId", labels.asset)}
          {mappingField("name", labels.name)}
          {mappingField("technology", labels.type)}
          {mappingField("wattage", labels.watt, true)}
          {mappingField("quantity", labels.qty)}
        </div>
        <div className="import-preview">
          <strong>
            {preview
              ? preview.message
              : p.language === "it"
                ? "Seleziona la colonna potenza."
                : "Select the wattage column."}
          </strong>
          {preview && (
            <span>
              {preview.skipped}{" "}
              {p.language === "it" ? "righe ignorate" : "rows skipped"}
            </span>
          )}
        </div>
        <div className="preview-table">
          <table>
            <thead>
              <tr>
                <th>
                  {state.mode === "individual"
                    ? p.language === "it"
                      ? "Lampada"
                      : "Luminaire"
                    : p.language === "it"
                      ? "Gruppo"
                      : "Group"}
                </th>
                <th>{p.language === "it" ? "Tipo" : "Type"}</th>
                <th>W</th>
                <th>{p.language === "it" ? "Quantità" : "Quantity"}</th>
              </tr>
            </thead>
            <tbody>
              {preview?.groups.slice(0, 8).map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.technology}</td>
                  <td>{group.existingWattage}</td>
                  <td>{group.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview?.groups.length > 8 && (
            <p className="hint">
              + {preview.groups.length - 8}{" "}
              {p.language === "it" ? "altre righe" : "more rows"}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={close}>{labels.cancel}</button>
          <button
            className="secondary"
            disabled={!preview?.groups.length}
            onClick={() => apply(preview.groups, "append")}
          >
            {labels.append}
          </button>
          <button
            className="primary"
            disabled={!preview?.groups.length}
            onClick={() => {
              if (
                confirm(
                  p.language === "it"
                    ? "Sostituire le righe esistenti con i dati importati?"
                    : "Replace existing rows with the imported data?",
                )
              )
                apply(preview.groups, "replace");
            }}
          >
            {labels.replace}
          </button>
        </div>
      </section>
    </div>
  );
}
function ProductSelect({ label, type, p, value, onChange }) {
  return (
    <Field label={label} value={value} onChange={onChange}>
      {p.catalogue.smart
        .filter((x) => x.type === type && x.active)
        .map((x) => (
          <option key={x.id} value={x.id}>
            {x.brand} {x.name}
          </option>
        ))}
    </Field>
  );
}
function Solution({ p, r, update, t, money, num }) {
  const ledProducts = [...r.groupRows.reduce((products, group) => {
    const id = group.product?.id;
    if (!group.upgradeSelected || !id || !group.quantity) return products;
    const current = products.get(id) || {
      label: `${group.product.brand || ""} ${group.product.name || ""} · ${num(group.product.wattage || 0)} W`.trim(),
      quantity: 0,
      total: 0,
    };
    current.quantity += group.quantity;
    current.total += group.salesTotal;
    products.set(id, current);
    return products;
  }, new Map()).values()];
  const smartRows = [
    r.lcuQuantity > 0 ? ["LCU", r.lcuQuantity, r.smartHardwareCapex] : null,
    r.implementationCapex > 0 ? [
      p.language === "it" ? "Implementazione" : "Implementation",
      r.lcuQuantity,
      r.implementationCapex,
    ] : null,
    r.cmsEnabled && r.cmsOpex > 0 ? ["CMS", r.lcuQuantity, r.cmsOpex] : null,
    r.hardware.gatewayQty > 0 ? ["Gateway", r.hardware.gatewayQty, r.gatewayCapex] : null,
    r.gatewayOpex > 0 ? ["Gateway OPEX", r.hardware.gatewayQty, r.gatewayOpex] : null,
    r.hardware.antennaQty > 0 ? ["Antenna", r.hardware.antennaQty, r.antennaCapex] : null,
    r.hardware.meterQty > 0 ? [
      p.language === "it" ? "Contatore" : "Energy meter",
      r.hardware.meterQty,
      r.meterCapex,
    ] : null,
  ].filter(Boolean);
  const smartCapex =
    r.smartHardwareCapex +
    r.implementationCapex +
    r.gatewayCapex +
    r.antennaCapex +
    r.meterCapex;
  const setSmartEnabled = (enabled) => {
    update(["solution", "smartEnabled"], enabled);
    if (!enabled) {
      update(["solution", "cmsEnabled"], false);
      update(["solution", "powerAidEnabled"], false);
    }
  };
  const setCmsEnabled = (enabled) => {
    update(["solution", "cmsEnabled"], enabled);
    if (!enabled) update(["solution", "powerAidEnabled"], false);
  };
  return (
    <div className="two-col">
      <Card title={t("solution")}>
        <div className="toggles">
          <Toggle
            label="Smart Lighting"
            value={p.solution.smartEnabled}
            onChange={setSmartEnabled}
          />
          <Toggle
            label="CMS"
            value={p.solution.cmsEnabled}
            disabled={!p.solution.smartEnabled}
            title={!p.solution.smartEnabled ? "Smart Lighting is required for CMS" : ""}
            onChange={setCmsEnabled}
          />
          <Toggle
            label="PowerAiD"
            value={p.solution.powerAidEnabled}
            disabled={!p.solution.smartEnabled || !p.solution.cmsEnabled}
            title={
              !p.solution.smartEnabled || !p.solution.cmsEnabled
                ? "Smart Lighting and CMS are required for PowerAiD"
                : ""
            }
            onChange={(v) => update(["solution", "powerAidEnabled"], v)}
          />
        </div>
        <div className="form-grid">
          <ProductSelect
            label="LCU"
            type="LCU"
            p={p}
            value={p.solution.lcuProductId}
            onChange={(v) => update(["solution", "lcuProductId"], v)}
          />
          <ProductSelect
            label="Gateway"
            type="Gateway"
            p={p}
            value={p.solution.gatewayProductId}
            onChange={(v) => update(["solution", "gatewayProductId"], v)}
          />
          <Field
            label={
              p.language === "it" ? "Quantità gateway" : "Gateway quantity"
            }
            value={p.solution.gatewayQuantity}
            onChange={(v) => update(["solution", "gatewayQuantity"], v)}
          />
          <ProductSelect
            label="Antenna"
            type="Antenna"
            p={p}
            value={p.solution.antennaProductId}
            onChange={(v) => update(["solution", "antennaProductId"], v)}
          />
          <Field
            label={
              p.language === "it" ? "Quantità antenne" : "Antenna quantity"
            }
            value={p.solution.antennaQuantity}
            onChange={(v) => update(["solution", "antennaQuantity"], v)}
          />
          <ProductSelect
            label={p.language === "it" ? "Contatore" : "Energy meter"}
            type="Energy Meter"
            p={p}
            value={p.solution.meterProductId}
            onChange={(v) => update(["solution", "meterProductId"], v)}
          />
          <Field
            label={
              p.language === "it" ? "Quantità contatori" : "Meter quantity"
            }
            value={p.solution.meterQuantity}
            onChange={(v) => update(["solution", "meterQuantity"], v)}
          />
        </div>
      </Card>
      <Card
        title={
          p.language === "it"
            ? "Riepilogo soluzione utilizzata"
            : "Used solution summary"
        }
      >
        <div className="solution-quantity-grid">
          <div><span>{p.language === "it" ? "Apparecchi esistenti totali" : "Total existing luminaires"}</span><strong>{num(r.totalQuantity)}</strong></div>
          <div><span>{p.language === "it" ? "Selezionati per upgrade" : "Selected for upgrade"}</span><strong>{num(r.upgradedQuantity)}</strong></div>
          <div><span>{p.language === "it" ? "Non sostituiti" : "Not upgraded"}</span><strong>{num(r.notUpgradedQuantity)}</strong></div>
        </div>
        <p className="hint">
          <strong>{p.language === "it" ? "Apparecchi LED" : "LED luminaires"}</strong>
        </p>
        <Breakdown
          rows={ledProducts.map((product) => [
            product.label,
            product.quantity,
            product.total,
          ])}
          money={money}
          number={num}
        />
        <div className="summary-line">
          <span>
            {p.language === "it" ? "Subtotale LED" : "LED subtotal"} · {num(r.upgradedQuantity)} {t("units")}
          </span>
          <strong>{money(r.ledCapex)}</strong>
        </div>
        {r.smartEnabled && <><p className="hint">
          <strong>Smart Lighting</strong>
        </p><div className="lcu-callout">
          <small>
            {p.language === "it"
              ? "Quantità LCU calcolata"
              : "Calculated LCU quantity"}
          </small>
          <strong>
            {num(r.lcuQuantity)} {t("units")}
          </strong>
          <span>
            {p.language === "it"
              ? "Calcolata dalle assegnazioni Smart Lighting"
              : "Calculated from Smart Lighting assignments"}
          </span>
        </div>
        <Breakdown
          rows={smartRows}
          money={money}
          number={num}
        />
        <div className="summary-line">
          <span>{p.language === "it" ? "Subtotale CAPEX Smart" : "Smart CAPEX subtotal"}</span>
          <strong>{money(smartCapex)}</strong>
        </div></>}
        {r.freight > 0 && <div className="summary-line">
          <span>{p.language === "it" ? "Trasporto" : "Freight"}</span>
          <strong>{money(r.freight)}</strong>
        </div>}
        <div className="summary-line">
          <span>{t("capex")}</span>
          <strong>{money(r.totalCapex)}</strong>
        </div>
        <div className="summary-line">
          <span>{p.language === "it" ? "OPEX annuo fisso" : "Fixed annual OPEX"}</span>
          <strong>{money(r.fixedAnnualOpex)}</strong>
        </div>
        {r.powerAidEnabled && <div className="summary-line service-fee-line">
          <span>{p.language === "it" ? "PowerAiD service fee (solo sul risparmio generato)" : "PowerAiD service fee (only on generated saving)"}</span>
          <strong>{money(r.powerAidCustomerFee)}</strong>
        </div>}
      </Card>
    </div>
  );
}
const Breakdown = ({ rows, money, number = (value) => value }) => (
  <div className="breakdown">
    {rows.map(([l, q, total]) => (
      <div key={l}>
        <span>{l}</span>
        <span>
          {number(q)} × {q ? money(total / q) : money(0)}
        </span>
        <strong>{money(total)}</strong>
      </div>
    ))}
  </div>
);
function Pricing({ p, r, update, t, money }) {
  const it = p.language === "it";
  const productRow = (id, label, q, product, key, total, costKey = key) => ({
    id,
    label,
    q,
    productId: product.id,
    key,
    cost: product[costKey] || 0,
    cat: product[key] || 0,
    total,
  });
  const rows = [
    ...r.groupRows.map((g, i) => g.upgradeSelected ? ({
      id: g.id,
      label: `LED · ${g.product.name}`,
      q: g.quantity,
      cost: g.product.costPrice,
      cat: g.product.salesPrice,
      total: g.salesTotal,
      groupIndex: i,
    }) : null).filter(Boolean),
    productRow(
      "lcu",
      "LCU",
      r.lcuQuantity,
      r.hardware.lcu,
      "salesPrice",
      r.smartHardwareCapex,
      "costPrice",
    ),
    productRow(
      "implementation",
      it ? "Implementazione LCU" : "LCU implementation",
      r.lcuQuantity,
      r.hardware.lcu,
      "implementationSalesPrice",
      r.implementationCapex,
      "implementationCost",
    ),
    productRow(
      "gateway",
      "Gateway",
      r.hardware.gatewayQty,
      r.hardware.gateway,
      "salesPrice",
      r.gatewayCapex,
      "costPrice",
    ),
    productRow(
      "antenna",
      "Antenna",
      r.hardware.antennaQty,
      r.hardware.antenna,
      "salesPrice",
      r.antennaCapex,
      "costPrice",
    ),
    productRow(
      "meter",
      it ? "Contatore" : "Energy meter",
      r.hardware.meterQty,
      r.hardware.meter,
      "salesPrice",
      r.meterCapex,
      "costPrice",
    ),
    {
      id: "freight",
      label: it ? "Trasporto" : "Freight",
      q: r.upgradedQuantity,
      cost: p.assumptions.freightCostPerLamp,
      cat: p.assumptions.freightSalesPerLamp,
      total: r.freight,
      assumptionKey: "freightSalesPerLamp",
    },
    productRow(
      "cms",
      it ? "CMS / anno" : "CMS / year",
      r.lcuQuantity,
      r.hardware.lcu,
      "annualSalesPrice",
      r.cmsOpex,
      "annualCost",
    ),
    productRow(
      "gateway-opex",
      it ? "Gateway OPEX / anno" : "Gateway OPEX / year",
      r.hardware.gatewayQty,
      r.hardware.gateway,
      "annualSalesPrice",
      r.gatewayOpex,
      "annualCost",
    ),
    {
      id: "poweraid",
      label: it ? "Fee cliente PowerAiD (% risparmio incrementale)" : "PowerAiD customer fee (% incremental saving)",
      q: 1,
      cost: p.assumptions.powerAidSupplierSharePercent,
      costTotal: r.powerAidSupplierCost,
      cat: p.assumptions.powerAidCustomerFeePercent,
      total: r.powerAidCustomerFee,
      assumptionKey: "powerAidCustomerFeePercent",
      percent: true,
    },
  ];
  const setProductOverride = (row, value) => {
    const overrides = { ...p.pricing.overrides };
    const productOverrides = { ...(overrides[row.productId] || {}) };
    if (value === "" || value == null) delete productOverrides[row.key];
    else productOverrides[row.key] = numberValue(value);
    if (Object.keys(productOverrides).length)
      overrides[row.productId] = productOverrides;
    else delete overrides[row.productId];
    update(["pricing", "overrides"], overrides);
  };
  return (
    <Card title={t("pricing")}>
      {p.importedCommercial && (
        <>
          <div className="assessment go">
            <div>
              <small>
                {it ? "Valori ufficiali importati" : "Imported official values"}
              </small>
              <strong>
                {it ? "Offerta Noleggio Operativo" : "Noleggio Operativo offer"}
              </strong>
            </div>
            <p>
              {it
                ? `CAPEX ufficiale ${money(p.assumptions.officialOfferCapex)} · OPEX servizi/anno ${money(p.assumptions.officialAnnualOpex)} · Canone tutto incluso/anno ${money(p.assumptions.allInclusiveAnnualPayment)} · Pagamenti totali ${money(p.importedCommercial.totalCustomerPayments || p.assumptions.allInclusiveAnnualPayment * p.assumptions.financingYears)}`
                : `Official CAPEX ${money(p.assumptions.officialOfferCapex)} · Service OPEX/year ${money(p.assumptions.officialAnnualOpex)} · All-inclusive/year ${money(p.assumptions.allInclusiveAnnualPayment)} · Total payments ${money(p.importedCommercial.totalCustomerPayments || p.assumptions.allInclusiveAnnualPayment * p.assumptions.financingYears)}`}
            </p>
          </div>
          <p className="hint">
            {it
              ? "La tabella sottostante è un controllo di catalogo; non sostituisce i valori ufficiali importati."
              : "The table below is a catalogue control calculation; it does not replace the imported official values."}
          </p>
        </>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                it ? "Componente" : "Component",
                it ? "Quantità" : "Quantity",
                it ? "Prezzo catalogo" : "Catalogue price",
                it ? "Costo" : "Cost",
                it ? "Prezzo progetto" : "Project override",
                it ? "Vendite totali" : "Total sales",
                it ? "Margine" : "Margin",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => {
              const sale = x.q ? x.total / x.q : 0,
                margin = x.total - (x.costTotal ?? x.q * (x.cost || 0));
              const override = x.productId
                ? p.pricing.overrides[x.productId]?.[x.key]
                : x.assumptionKey
                  ? p.assumptions[x.assumptionKey]
                  : null;
              return (
                <tr key={`${x.id}-${i}`}>
                  <td>{x.label}</td>
                  <td>{formatNumber(x.q, p.language)}</td>
                  <td>
                    {x.percent
                      ? formatPercent(x.cat, p.language)
                      : money(x.cat)}
                  </td>
                  <td>
                    {x.percent
                      ? formatPercent(x.cost, p.language)
                      : money(x.cost)}
                  </td>
                  <td>
                    {x.groupIndex != null ? (
                      <NumericInput
                        value={p.groups[x.groupIndex].projectLedPrice}
                        placeholder={String(x.cat)}
                        onChange={(v) =>
                          update(
                            ["groups", x.groupIndex, "projectLedPrice"],
                            v === "" ? null : v,
                          )
                        }
                      />
                    ) : x.productId || x.assumptionKey ? (
                      <NumericInput
                        value={override ?? ""}
                        placeholder={String(x.cat)}
                        onChange={(v) =>
                          x.productId
                            ? setProductOverride(x, v)
                            : update(["assumptions", x.assumptionKey], v)
                        }
                      />
                    ) : (
                      money(sale)
                    )}
                  </td>
                  <td>{money(x.total)}</td>
                  <td className={margin < 0 ? "negative" : "positive"}>
                    {money(margin)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="summary-line">
        <span>{t("capex")}</span>
        <strong>{money(r.totalCapex)}</strong>
      </div>
      <div className="summary-line">
        <span>{t("annualOpex")}</span>
        <strong>{money(r.totalAnnualOpex)}</strong>
      </div>
      <p className="hint">
        {it
          ? "I prezzi specifici del progetto non modificano i valori del catalogo."
          : "Project-specific prices do not modify catalogue defaults."}
      </p>
    </Card>
  );
}
const assumptionGroups = (t) => [
  [
    t("technical"),
    [
      ["operatingHours", t("operatingHours")],
      ["energyPrice", t("energyPrice")],
      ["sapFactor", t("sapFactor")],
      ["mhFactor", t("mhFactor")],
      ["mercuryFactor", t("mercuryFactor")],
      ["co2KgPerKwh", t("co2Factor")],
    ],
  ],
  [
    t("savings"),
    [
      ["cloPercent", t("cloPercent")],
      ["powerAidPercent", t("powerAidPercent")],
      ["powerAidCustomerFeePercent", t("powerAidCustomerFee")],
      ["powerAidSupplierSharePercent", t("powerAidSupplierShare")],
      ["existingMaintenance", t("existingMaintenance")],
      ["newMaintenance", t("newMaintenance")],
    ],
  ],
  [
    t("financial"),
    [
      ["serviceAgreementPeriod", t("serviceAgreementPeriod")],
      ["financingPeriod", t("financingPeriod")],
      ["analysisPeriod", t("analysisPeriod")],
      ["interestRate", t("interestRate")],
      ["allInclusiveAnnualPayment", t("allInclusiveAnnualPayment")],
      ["upfrontPayment", t("upfrontPayment")],
      ["energyEscalation", t("energyEscalation")],
      ["opexEscalation", t("opexEscalation")],
      ["discountRate", t("discountRate")],
    ],
  ],
  [
    t("freight"),
    [
      ["freightCostPerLamp", t("freightCost")],
      ["freightSalesPerLamp", t("freightSales")],
    ],
  ],
];
function Assumptions({ p, r, update }) {
  const t = useT(p.language);
  const type = p.assumptions.dealType || "cash";
  const [dimmingTechnology, setDimmingTechnology] = useState("ALL");
  const [dimmingWattage, setDimmingWattage] = useState("ALL");
  const dimmingTargets = p.groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => dimmingTechnology === "ALL" || group.technology === dimmingTechnology)
    .filter(({ group }) => dimmingWattage === "ALL" || String(group.existingWattage) === dimmingWattage);
  const dimmingWattages = [...new Set(p.groups
    .filter((group) => dimmingTechnology === "ALL" || group.technology === dimmingTechnology)
    .map((group) => String(group.existingWattage)))]
    .sort((a, b) => numberValue(a) - numberValue(b));
  const applyVisibleDimmingProfile = () => {
    const source = dimmingTargets[0]?.group;
    if (!source) return;
    const keys = ["existingDimmingProfile", "existingDimmingMethod", "existingDimmingPercent", "existingFullPowerHours", "existingReducedHours", "existingReducedLoadPercent", "existingDriverType", "existingDimmingNote"];
    const targetIndexes = new Set(dimmingTargets.map(({ index }) => index));
    update(["groups"], p.groups.map((group, index) => targetIndexes.has(index)
      ? { ...group, ...Object.fromEntries(keys.map((key) => [key, source[key]])), existingSystemFactor: source.existingSystemFactor }
      : group));
  };
  return (
    <div className="cards-grid">
      {assumptionGroups(t).map(([title, fields], index) => (
        <Card title={title} key={title}>
          <div className="form-grid">
            {index === 2 && (
              <>
                <Field
                  label={t("dealType")}
                  value={type}
                  onChange={(v) => update(["assumptions", "dealType"], v)}
                >
                  <option value="cash">{t("cashDeal")}</option>
                  <option value="noleggio_operativo">
                    {t("noleggioOperativo")}
                  </option>
                  <option value="finance">{t("financeSolution")}</option>
                </Field>
                {type !== "cash" && (
                  <Field
                    label={t("rateProfile")}
                    value={p.assumptions.rateProfileId || "custom"}
                    onChange={(v) =>
                      update(["assumptions", "rateProfileId"], v)
                    }
                  >
                    {RATE_PROFILES.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                        {profile.annualRate == null
                          ? ""
                          : ` · ${profile.annualRate}%`}
                      </option>
                    ))}
                  </Field>
                )}
              </>
            )}
            {fields
              .filter(
                ([k]) =>
                  type !== "cash" ||
                  !["financingPeriod", "interestRate"].includes(k),
              )
              .filter(
                ([k]) =>
                  type === "noleggio_operativo" ||
                  k !== "allInclusiveAnnualPayment",
              )
              .map(([k, l]) => (
                <Field
                  key={k}
                  label={l}
                  value={p.assumptions[k]}
                  disabled={
                    !p.solution.powerAidEnabled &&
                    ["powerAidPercent", "powerAidCustomerFeePercent", "powerAidSupplierSharePercent"].includes(k)
                  }
                  onChange={(v) => update(["assumptions", k], v)}
                />
              ))}
          </div>
        </Card>
      ))}
      <Card
        className="dimming-card"
        title={
          p.language === "it"
            ? "Baseline e dimmer esistente"
            : "Existing baseline & dimming"
        }
      >
        <div className="dimming-bulk">
          <label>
            <span>{p.language === "it" ? "Filtra tecnologia" : "Filter technology"}</span>
            <select value={dimmingTechnology} onChange={(event) => { setDimmingTechnology(event.target.value); setDimmingWattage("ALL"); }}>
              <option value="ALL">{p.language === "it" ? "Tutte" : "All"}</option>
              {[...new Set(p.groups.map((group) => group.technology))].map((technology) => <option key={technology} value={technology}>{technology}</option>)}
            </select>
          </label>
          <label>
            <span>{p.language === "it" ? "Filtra potenza" : "Filter wattage"}</span>
            <select value={dimmingWattage} onChange={(event) => setDimmingWattage(event.target.value)}>
              <option value="ALL">{p.language === "it" ? "Tutte" : "All"}</option>
              {dimmingWattages.map((wattage) => <option key={wattage} value={wattage}>{wattage} W</option>)}
            </select>
          </label>
          <button className="primary" disabled={!dimmingTargets.length} onClick={applyVisibleDimmingProfile}>
            {p.language === "it" ? `Applica la prima riga a ${dimmingTargets.length} gruppi` : `Apply first row to ${dimmingTargets.length} groups`}
          </button>
          <small>{p.language === "it" ? "La prima riga filtrata viene usata come modello." : "The first filtered row is used as the template."}</small>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  p.language === "it" ? "Gruppo" : "Group",
                  p.language === "it" ? "Profilo dimmer" : "Dimming profile",
                  p.language === "it" ? "Metodo" : "Method",
                  p.language === "it"
                    ? "Riduzione media annua %"
                    : "Annual average reduction %",
                  p.language === "it" ? "Ore piena potenza" : "Full-power hours",
                  p.language === "it" ? "Ore ridotte" : "Reduced hours",
                  p.language === "it" ? "Livello potenza residua %" : "Remaining power level %",
                  p.language === "it" ? "Riduzione effettiva %" : "Effective reduction %",
                  p.language === "it" ? "Fattore sistema" : "System factor",
                  p.language === "it" ? "Tipo driver" : "Driver type",
                  p.language === "it" ? "Nota" : "Note",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.groups.map((g, i) => {
                const calculated = r.groupRows.find((row) => row.id === g.id) || {};
                const detailed = g.existingDimmingProfile === "fixed" && g.existingDimmingMethod === "profile";
                const hourDifference = Math.abs(numberValue(calculated.profileHoursTotal) - numberValue(p.assumptions.operatingHours));
                const hoursMismatch = detailed && hourDifference > 0.1;
                return <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>
                    <select
                      value={g.existingDimmingProfile}
                      onChange={(e) =>
                        update(
                          ["groups", i, "existingDimmingProfile"],
                          e.target.value,
                        )
                      }
                    >
                      <option value="none">None</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={g.existingDimmingMethod || "average"}
                      disabled={g.existingDimmingProfile !== "fixed"}
                      onChange={(e) => update(["groups", i, "existingDimmingMethod"], e.target.value)}
                    >
                      <option value="average">{p.language === "it" ? "Media annua" : "Annual average"}</option>
                      <option value="profile">{p.language === "it" ? "Profilo orario" : "Hourly profile"}</option>
                    </select>
                  </td>
                  <td>
                    <NumericInput
                      value={g.existingDimmingPercent}
                      disabled={g.existingDimmingProfile !== "fixed" || detailed}
                      onChange={(v) =>
                        update(["groups", i, "existingDimmingPercent"], v)
                      }
                    />
                  </td>
                  <td>
                    <NumericInput value={g.existingFullPowerHours} disabled={!detailed} onChange={(v) => update(["groups", i, "existingFullPowerHours"], v)} />
                  </td>
                  <td>
                    <NumericInput value={g.existingReducedHours} disabled={!detailed} onChange={(v) => update(["groups", i, "existingReducedHours"], v)} />
                  </td>
                  <td>
                    <NumericInput value={g.existingReducedLoadPercent} disabled={!detailed} onChange={(v) => update(["groups", i, "existingReducedLoadPercent"], v)} />
                  </td>
                  <td className={hoursMismatch ? "dimming-warning" : "dimming-result"}>
                    <strong>{formatNumber(calculated.dimmingPercent || 0, p.language, 2)}%</strong>
                    {hoursMismatch && <small>{p.language === "it" ? `Ore totali ${formatNumber(calculated.profileHoursTotal, p.language)} ≠ ${formatNumber(p.assumptions.operatingHours, p.language)}` : `Total hours ${formatNumber(calculated.profileHoursTotal, p.language)} ≠ ${formatNumber(p.assumptions.operatingHours, p.language)}`}</small>}
                  </td>
                  <td>
                    <NumericInput value={g.existingSystemFactor || calculated.systemFactor || 1} onChange={(v) => update(["groups", i, "existingSystemFactor"], v)} />
                  </td>
                  <td>
                    <select
                      value={g.existingDriverType}
                      onChange={(e) =>
                        update(
                          ["groups", i, "existingDriverType"],
                          e.target.value,
                        )
                      }
                    >
                      {[
                        ["non_dimmable", "Non-dimmable"],
                        ["1_10v", "1-10V"],
                        ["dali", "DALI"],
                        ["other", "Other"],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={g.existingDimmingNote}
                      placeholder="23:00–05:00"
                      onChange={(e) =>
                        update(
                          ["groups", i, "existingDimmingNote"],
                          e.target.value,
                        )
                      }
                    />
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">
          {p.language === "it"
            ? "La riduzione media annua è ponderata sull'intero periodo di funzionamento. Il livello di potenza residua indica la potenza utilizzata durante le ore ridotte: 70% significa una riduzione del 30%. Il calcolo è ore ridotte × (100% − livello residuo) ÷ ore annue. Il fattore sistema predefinito può essere sovrascritto per ogni gruppo."
            : "The annual average reduction is weighted across all operating hours. Remaining power level means the power used during reduced hours: 70% means a 30% reduction. The calculation is reduced hours × (100% − remaining level) ÷ annual hours. The default system factor can be overridden for every group."}
        </p>
      </Card>
    </div>
  );
}
function Kpis({ p, r, t, money, num }) {
  const allInclusive = r.dealType === "noleggio_operativo";
  const luminaires = Math.max(1, r.upgradedQuantity);
  const money2 = (value) =>
    formatMoney(value, p.language, p.project.currency, 2);
  const opexLabel = allInclusive
    ? p.language === "it"
      ? "OPEX mensile (incluso nel canone)"
      : "Monthly OPEX (included in payment)"
    : p.language === "it"
      ? "OPEX mensile"
      : "Monthly OPEX";
  const paymentLabel = allInclusive
    ? p.language === "it"
      ? "Canone Mensile Tutto Incluso"
      : "All-inclusive Monthly Payment"
    : p.language === "it"
      ? "Rata mensile finanziamento"
      : "Monthly financing payment";
  const paymentKpis = allInclusive
    ? [
        [paymentLabel, money2(r.monthlyPayment)],
        [
          p.language === "it"
            ? "Canone mensile per apparecchio"
            : "Monthly payment per luminaire",
          money2(r.monthlyPayment / luminaires),
        ],
      ]
    : r.dealType === "finance"
      ? [
          [paymentLabel, money2(r.financingMonthlyPayment)],
          [
            p.language === "it"
              ? "Rata finanziamento per apparecchio"
              : "Financing payment per luminaire",
            money2(r.financingMonthlyPayment / luminaires),
          ],
          [
            p.language === "it"
              ? "Pagamento cliente mensile totale"
              : "Total monthly customer payment",
            money2(r.monthlyPayment),
          ],
          [
            p.language === "it"
              ? "Pagamento totale per apparecchio"
              : "Total payment per luminaire",
            money2(r.monthlyPayment / luminaires),
          ],
        ]
      : [];
  const list = [
    [t("capex"), money(r.totalCapex)],
    [opexLabel, money2(r.fixedAnnualOpex / 12)],
    [
      p.language === "it"
        ? "OPEX annuo per apparecchio"
        : "Annual OPEX per luminaire",
      money2(r.fixedAnnualOpex / luminaires),
    ],
    ...(r.powerAidEnabled ? [[
      p.language === "it" ? "PowerAiD service fee annua" : "Annual PowerAiD service fee",
      money2(r.powerAidCustomerFee),
    ], [
      p.language === "it" ? "Beneficio netto cliente PowerAiD" : "Customer net PowerAiD benefit",
      money2(r.powerAidCustomerNetBenefit),
      "positive",
    ]] : []),
    ...paymentKpis,
    [t("annualNet"), money(r.customerAnnualNetBenefit)],
    [
      t("payback"),
      r.payback == null
        ? t("notAvailable")
        : `${num(r.payback, 1)} ${t("years")}`,
    ],
    [t("roi"), formatPercent(r.roiPercent, p.language)],
    [`${t("npv")} – ${r.analysisPeriod} ${t("years")}`, money(r.npv)],
    [
      `${t("lifecycle")} – ${r.analysisPeriod} ${t("years")}`,
      money(r.lifecycleResult),
    ],
    [p.language === "it" ? "Riduzione intera installazione" : "Whole-installation reduction", formatPercent(r.energyReductionPercent, p.language)],
    [p.language === "it" ? "Riduzione apparecchi aggiornati" : "Upgraded-luminaire reduction", formatPercent(r.upgradedEnergyReductionPercent, p.language)],
    [t("co2Reduction"), `${num(r.co2ReductionKg / 1000, 1)} t`],
  ];
  return (
    <div className="kpis">
      {list.map(([l, v, c]) => (
        <div className={`kpi ${c || ""}`} key={l}>
          <span>{l}</span>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}
function Business({ p, r, t, money, num }) {
  const allInclusive = r.dealType === "noleggio_operativo";
  const opexLabel = allInclusive
    ? p.language === "it"
      ? "OPEX annuo (incluso nel canone)"
      : "Annual OPEX (included in payment)"
    : t("annualOpex");
  const paymentLabel = allInclusive
    ? p.language === "it"
      ? "Canone annuo tutto incluso"
      : "All-inclusive annual payment"
    : p.language === "it"
      ? "Rata annua finanziamento"
      : "Annual financing payment";
  const paymentValue = allInclusive
    ? r.allInclusiveAnnualPayment
    : r.financingAnnualPayment;
  const assessmentText =
    p.language === "it"
      ? `La valutazione cliente si basa sul beneficio netto annuo e sul VAN nel periodo di analisi di ${r.analysisPeriod} anni.`
      : `The customer assessment is based on annual net benefit and NPV over the ${r.analysisPeriod}-year analysis period.`;
  return (
    <>
      <div className={`assessment ${r.customerDecisionStatus.toLowerCase()}`}>
        <div>
          <small>{t("preliminary")}</small>
          <h2>{r.customerDecisionStatus.replace("_", "-")}</h2>
        </div>
        <p>{assessmentText}</p>
      </div>
      <Kpis p={p} r={r} t={t} money={money} num={num} />
      <div className="two-col">
        <Card
          title={
            p.language === "it" ? "Cascata dei risparmi" : "Savings waterfall"
          }
        >
          <Breakdown
            money={(v) => `${num(v)} kWh`}
            number={num}
            rows={[
              [
                p.language === "it"
                  ? "Consumo nominale di sistema"
                  : "Nominal system consumption",
                1,
                r.nominalSystemKwh,
              ],
              [
                p.language === "it"
                  ? "Riduzione dimmer esistente"
                  : "Existing fixed dimming reduction",
                1,
                r.existingDimmingSavingKwh,
              ],
              [t("baseline"), 1, r.baselineKwh],
              [p.language === "it" ? "Baseline apparecchi selezionati" : "Selected-luminaire baseline", 1, r.upgradedBaselineKwh],
              [p.language === "it" ? "Consumo apparecchi non sostituiti" : "Non-upgraded consumption", 1, r.notUpgradedBaselineKwh],
              [
                p.language === "it" ? "Consumo LED" : "LED consumption",
                1,
                r.ledKwh,
              ],
              [t("ledSaving"), 1, r.ledSavingKwh],
              [t("cloSaving"), 1, r.cloSavingKwh],
              [
                p.language === "it"
                  ? "Consumo dopo CLO"
                  : "Consumption after CLO",
                1,
                r.afterCloKwh,
              ],
              [t("powerSaving"), 1, r.powerAidSavingKwh],
              [t("final"), 1, r.finalKwh],
              [p.language === "it" ? "Consumo finale apparecchi aggiornati" : "Upgraded-luminaire final consumption", 1, r.upgradedFinalKwh],
            ]}
          />
        </Card>
        <Card
          title={p.language === "it" ? "Benefici annuali" : "Annual benefits"}
        >
          <Breakdown
            money={money}
            number={num}
            rows={[
              [
                p.language === "it" ? "Risparmio energia" : "Energy saving",
                1,
                r.energySaving,
              ],
              [t("maintenanceSaving"), 1, r.maintenanceSaving],
              [
                p.language === "it"
                  ? "Beneficio totale"
                  : "Total annual benefit",
                1,
                r.grossBenefit,
              ],
              [p.language === "it" ? "OPEX annuo fisso" : "Fixed annual OPEX", 1, r.fixedAnnualOpex],
              ...(r.powerAidEnabled ? [["PowerAiD service fee", 1, r.powerAidCustomerFee]] : []),
              ...(r.dealType === "cash" ? [] : [[paymentLabel, 1, paymentValue]]),
              [t("annualNet"), 1, r.customerAnnualNetBenefit],
            ]}
          />
        </Card>
      </div>
      {r.powerAidEnabled && <Card title={p.language === "it" ? "Valore PowerAiD per il cliente" : "PowerAiD customer value"}>
        <p className="hint poweraid-explanation">
          {p.language === "it"
            ? "La fee è variabile e viene applicata esclusivamente al risparmio energetico incrementale effettivamente generato da PowerAiD. Se non viene generato alcun risparmio, la fee è pari a zero."
            : "The fee is variable and applies only to the incremental energy saving actually generated by PowerAiD. If no saving is generated, the fee is zero."}
        </p>
        <div className="poweraid-value-grid">
          <div><span>{p.language === "it" ? "Risparmio energia senza PowerAiD" : "Energy saving without PowerAiD"}</span><strong>{money(r.energySavingWithoutPowerAid)}</strong></div>
          <div><span>{p.language === "it" ? "Risparmio energia con PowerAiD" : "Energy saving with PowerAiD"}</span><strong>{money(r.energySaving)}</strong></div>
          <div><span>{p.language === "it" ? "Risparmio incrementale PowerAiD" : "PowerAiD incremental saving"}</span><strong>{money(r.powerAidGrossSavingEUR)}</strong></div>
          <div><span>PowerAiD service fee</span><strong>{money(r.powerAidCustomerFee)}</strong></div>
          <div className="poweraid-net"><span>{p.language === "it" ? "Beneficio netto aggiuntivo cliente" : "Additional customer net benefit"}</span><strong>{money(r.powerAidCustomerNetBenefit)}</strong></div>
        </div>
      </Card>}
    </>
  );
}

function InternalReport({ p, r, update, money }) {
  const it = p.language === "it";
  const pct = (v) => formatPercent(v, p.language);
  const fields = [
    [
      "agent1Name",
      it ? "Agente / consulente 1" : "Agent / consultant 1",
    ],
    [
      "agent1CommissionPercent",
      it ? "Commissione agente 1 (%)" : "Agent 1 commission (%)",
    ],
    [
      "agent2Name",
      it ? "Agente / consulente 2" : "Agent / consultant 2",
    ],
    [
      "agent2CommissionPercent",
      it ? "Commissione agente 2 (%)" : "Agent 2 commission (%)",
    ],
    ["dutyCost", it ? "Duty / dazi (€)" : "Duty (€)"],
    [
      "warrantyReservePercent",
      it ? "Riserva garanzia (%)" : "Warranty reserve (%)",
    ],
    ["fundingCostPercent", it ? "Costo finanziamento (%)" : "Funding cost (%)"],
    ["otherDirectCosts", it ? "Altri costi diretti" : "Other direct costs"],
    [
      "minimumMarginPercent",
      it ? "Margine minimo GO (%)" : "Minimum GO margin (%)",
    ],
  ];
  const costs = [
    [
      it ? "Costo prodotti e implementazione" : "Products and implementation",
      r.capexDirectCost,
    ],
    [it ? "OPEX del contratto" : "Contract OPEX", r.contractOpexCost],
    [it ? "Duty / dazi" : "Duty", r.dutyCost],
    [
      `${p.assumptions.agent1Name || (it ? "Agente 1" : "Agent 1")} · ${pct(p.assumptions.agent1CommissionPercent)}`,
      r.agent1CommissionCost,
    ],
    [
      `${p.assumptions.agent2Name || (it ? "Agente 2" : "Agent 2")} · ${pct(p.assumptions.agent2CommissionPercent)}`,
      r.agent2CommissionCost,
    ],
    [it ? "Commissioni totali" : "Total commissions", r.commissionCost],
    [it ? "Riserva garanzia" : "Warranty reserve", r.warrantyReserve],
    [it ? "Costo finanziamento" : "Financing cost", r.financingCost],
    [
      it ? "Altri costi diretti" : "Other direct costs",
      p.assumptions.otherDirectCosts,
    ],
    [it ? "Costi diretti totali" : "Total direct costs", r.totalDirectCosts],
  ];
  return (
    <>
      <div className={`assessment ${r.decisionStatus.toLowerCase()}`}>
        <div>
          <small>
            {it ? "Valutazione interna VIMALUX" : "Internal VIMALUX assessment"}
          </small>
          <h2>{r.decisionStatus.replace("_", "-")}</h2>
        </div>
        <p>
          {it
            ? `Margine netto ${pct(r.netProjectMarginPercent)} · requisito GO ${pct(r.minimumMarginPercent)}`
            : `Net margin ${pct(r.netProjectMarginPercent)} · GO requirement ${pct(r.minimumMarginPercent)}`}
        </p>
      </div>
      <div className="kpis">
        <div className="kpi">
          <span>{it ? "Valore contratto" : "Contract revenue"}</span>
          <strong>{money(r.totalContractRevenue)}</strong>
        </div>
        <div className="kpi">
          <span>{it ? "Costi diretti" : "Direct costs"}</span>
          <strong>{money(r.totalDirectCosts)}</strong>
        </div>
        <div className="kpi">
          <span>{it ? "Utile netto progetto" : "Net project profit"}</span>
          <strong className={r.netProjectProfit >= 0 ? "positive" : "negative"}>
            {money(r.netProjectProfit)}
          </strong>
        </div>
        <div className="kpi">
          <span>{it ? "Margine netto" : "Net margin"}</span>
          <strong
            className={
              r.netProjectMarginPercent >= r.minimumMarginPercent
                ? "positive"
                : "negative"
            }
          >
            {pct(r.netProjectMarginPercent)}
          </strong>
        </div>
        <div className="kpi">
          <span>{it ? "Utile per apparecchio" : "Profit per luminaire"}</span>
          <strong>{money(r.netProjectProfit / Math.max(1, r.upgradedQuantity))}</strong>
        </div>
      </div>
      <div className="two-col">
        <Card title={it ? "Parametri interni" : "Internal parameters"}>
          <div className="form-grid">
            {fields.map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={p.assumptions[key]}
                onChange={(value) => update(["assumptions", key], value)}
              />
            ))}
          </div>
          <div className="commission-basis">
            <div><span>{it ? "Vendita lampade LED" : "LED luminaire sales"}</span><strong>{money(r.ledCapex)}</strong></div>
            <div><span>{it ? "Meno trasporto" : "Less freight"}</span><strong>− {money(r.freightCost)}</strong></div>
            <div><span>{it ? "Meno duty / dazi" : "Less duty"}</span><strong>− {money(r.dutyCost)}</strong></div>
            <div className="commission-basis-total"><span>{it ? "Base commissionabile" : "Commissionable base"}</span><strong>{money(r.commissionableLampSales)}</strong></div>
          </div>
          <p className="hint">
            {it
              ? "Questi valori sono interni e non compaiono nel rapporto cliente."
              : "These values are internal and do not appear in the customer report."}
          </p>
        </Card>
        <Card
          title={
            it ? "Conto economico del progetto" : "Project profit and loss"
          }
        >
          <div className="breakdown">
            {costs.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <span></span>
                <strong>{money(value)}</strong>
              </div>
            ))}
            <div>
              <span>{it ? "Ricavi contratto" : "Contract revenue"}</span>
              <span></span>
              <strong>{money(r.totalContractRevenue)}</strong>
            </div>
            <div>
              <span>{it ? "Utile netto progetto" : "Net project profit"}</span>
              <span></span>
              <strong
                className={r.netProjectProfit >= 0 ? "positive" : "negative"}
              >
                {money(r.netProjectProfit)}
              </strong>
            </div>
          </div>
        </Card>
      </div>
      {r.powerAidEnabled && (
        <Card title={it ? "Economia PowerAiD / Felicity" : "PowerAiD / Felicity economics"}>
          <div className="poweraid-common">
            <span>{it ? "Risparmio incrementale cliente" : "Customer incremental saving"}</span>
            <strong>{money(r.powerAidGrossSavingEUR)}</strong>
            <span>{it ? `Fee cliente (${pct(p.assumptions.powerAidCustomerFeePercent)})` : `Customer fee (${pct(p.assumptions.powerAidCustomerFeePercent)})`}</span>
            <strong>{money(r.powerAidCustomerFee)}</strong>
          </div>
          <div className="poweraid-partner-grid">
            <section>
              <h3>VIMALUX</h3>
              <div><span>{it ? "Fee cliente annua" : "Annual customer fee"}</span><strong>{money(r.powerAidCustomerFee)}</strong></div>
              <div><span>{it ? "Meno quota Felicity" : "Less Felicity share"}</span><strong>− {money(r.powerAidSupplierCost)}</strong></div>
              <div><span>{it ? "Margine lordo annuo" : "Annual gross margin"}</span><strong className="positive">{money(r.powerAidVimaluxMargin)}</strong></div>
              <div><span>{it ? "Margine contratto" : "Contract margin"}</span><strong className="positive">{money(r.powerAidVimaluxContractMargin)}</strong></div>
              <div><span>MRR</span><strong>{money(r.powerAidVimaluxMargin / 12)}</strong></div>
            </section>
            <section>
              <h3>Felicity</h3>
              <div><span>{it ? `Quota del fee (${pct(p.assumptions.powerAidSupplierSharePercent)})` : `Share of fee (${pct(p.assumptions.powerAidSupplierSharePercent)})`}</span><strong>{money(r.powerAidSupplierCost)}</strong></div>
              <div><span>{it ? "Valore annuo / ARR" : "Annual value / ARR"}</span><strong>{money(r.powerAidSupplierCost)}</strong></div>
              <div><span>{it ? "Valore mensile / MRR" : "Monthly value / MRR"}</span><strong>{money(r.powerAidSupplierCost / 12)}</strong></div>
              <div><span>{it ? "Valore contratto" : "Contract value"}</span><strong>{money(r.powerAidSupplierContractCost)}</strong></div>
            </section>
          </div>
        </Card>
      )}
    </>
  );
}
function Report({ p, r, t, money, num }) {
  return (
    <>
      <div className="report-actions">
        <p>
          {p.language === "it"
            ? "Anteprima del rapporto cliente basata sullo stesso motore di calcolo dell’analisi economica."
            : "Customer report preview based on the same calculation engine as the business case."}
        </p>
        <button className="primary" onClick={() => generateCustomerPdf(p, r)}>
          {t("generate")}
        </button>
      </div>
      <div className="report-preview">
        <div className="report-head">
          <b>VIMALUX Intelligence</b>
          <h2>
            {p.language === "it"
              ? "Studio Preliminare di Fattibilità Economica"
              : "Preliminary Business Case"}
          </h2>
          <span>
            {p.project.businessCaseId} · {p.customer.name || "—"} ·{" "}
            {p.project.date}
          </span>
        </div>
        <h3>
          {p.language === "it" ? "Sintesi Esecutiva" : "Executive Summary"}
        </h3>
        <Kpis p={p} r={r} t={t} money={money} num={num} />
        <p className="conclusion">{t(r.customerDecisionStatus)}</p>
        <CustomerValueChart p={p} r={r} money={money} />
        <h3>
          {p.language === "it"
            ? "Flusso di cassa cliente"
            : "Customer cash flow"}
        </h3>
        <CashTable p={p} r={r} money={money} />
        <p className="disclaimer">
          {p.language === "it"
            ? "Questa analisi rappresenta una valutazione preliminare basata su quantità aggregate, potenze medie e ipotesi commerciali. I dati definitivi saranno sviluppati tramite VIMALUX Planner."
            : "This analysis is a preliminary assessment based on aggregated quantities, average wattages and commercial assumptions. Final data will be developed through VIMALUX Planner."}
        </p>
      </div>
    </>
  );
}
function CustomerValueChart({ p, r, money }) {
  const it = p.language === "it";
  const rows = r.customerValueRows || [];
  const first = rows[0];
  if (!first) return null;
  const postContract = r.serviceAgreementPeriod < r.analysisPeriod ? rows[r.serviceAgreementPeriod] : null;
  const segments = (row, fullSmart = false) => {
    const values = fullSmart ? {
      future: Math.max(0, row.currentOperatingCost - row.fullSmartBenefit),
      service: row.fullSmartOpex,
      payment: row.investmentPayment,
      saving: row.fullSmartNetBenefit,
    } : { future: row.futureOperatingCost, service: row.servicePayment, payment: row.investmentPayment, saving: row.customerSaving };
    return Object.entries(values).map(([key, value]) => ({ key, value, pct: row.currentOperatingCost ? value / row.currentOperatingCost * 100 : 0 }));
  };
  const scenarios = [
    { key: "current", label: it ? "Situazione attuale" : "Current situation", year: null, current: true, cost: first.currentOperatingCost },
    { key: "contract", label: it ? "Nuova soluzione" : "New solution", parts: segments(first) },
  ];
  const financingChanges = r.financingPeriod < r.analysisPeriod && rows[r.financingPeriod - 1]?.investmentPayment !== rows[r.financingPeriod]?.investmentPayment;
  const phaseStarts = [...new Set([1, financingChanges ? r.financingPeriod + 1 : null, r.serviceAgreementPeriod + 1].filter((year) => year && year <= r.analysisPeriod))].sort((a, b) => a - b);
  const phases = phaseStarts.map((start, index) => {
    const end = (phaseStarts[index + 1] || r.analysisPeriod + 1) - 1;
    const row = rows[start - 1];
    return { start, end, row, financing: row.investmentPayment > 0, smart: start <= r.serviceAgreementPeriod };
  });
  const partLabel = { future: it ? "Costo futuro" : "Future cost", service: "OPEX", payment: it ? "Investimento" : "Investment", saving: it ? "Risparmio cliente" : "Customer saving" };
  return (
    <section className="customer-value-chart">
      <h3>{it ? "Confronto dei costi annuali - anno 1" : "Annual cost comparison - year 1"}</h3>
      <p className="chart-intro">{it ? `Le colonne mostrano l'anno 1. La sequenza sottostante mostra l'intero periodo di analisi di ${r.analysisPeriod} anni.` : `The columns show year 1. The timeline below shows the full ${r.analysisPeriod}-year analysis period.`}</p>
      <div className={`value-summary-plot scenarios-${scenarios.length}`}>
        {scenarios.map((scenario) => (
          <div className="value-summary-scenario" key={scenario.key}>
            <div className="value-summary-bar">
              {scenario.current ? (
                <span className="value-current" style={{ height: "100%" }}><b>100%</b><small>{money(scenario.cost)}</small></span>
              ) : scenario.parts.map((part) => part.value > 0 && (
                <span key={part.key} className={`value-${part.key}`} style={{ height: `${Math.max(0, part.pct)}%` }} title={`${partLabel[part.key]}: ${money(part.value)}`}>
                  {part.pct >= 8 && <><b>{Math.round(part.pct)}%</b><small>{money(part.value)}</small></>}
                </span>
              ))}
            </div>
            <strong>{scenario.label}</strong>
          </div>
        ))}
      </div>
      <div className="value-chart-legend">
        <span><i className="value-future" />{it ? "Costo operativo post-upgrade" : "Post-upgrade operating cost"}</span>
        <span><i className="value-service" />{it ? "OPEX servizi" : "Service OPEX"}</span>
        <span><i className="value-payment" />{it ? "Pagamento contratto / investimento" : "Contract / investment payment"}</span>
        <span><i className="value-saving" />{it ? "Risparmio netto cliente" : "Customer net saving"}</span>
      </div>
      <div className="contract-phase-timeline">
        {phases.map((phase) => (
          <div className={`contract-phase ${phase.smart ? "smart-active" : "smart-inactive"}`} key={phase.start}>
            <strong>{it ? "Anni" : "Years"} {phase.start}{phase.end > phase.start ? `–${phase.end}` : ""}</strong>
            <span>{phase.financing ? (it ? "Finanziamento attivo" : "Financing active") : (it ? "Finanziamento concluso" : "Financing completed")}</span>
            <span>{phase.smart ? "Smart / CMS attivo" : (it ? "Smart / CMS concluso" : "Smart / CMS ended")}</span>
            <b>{it ? "Risparmio netto annuo" : "Annual net saving"}: {money(phase.row.customerSaving)}</b>
          </div>
        ))}
      </div>
      {r.cmsEnabled && postContract && (
        <div className="smart-continuation-callout">
          <div><span>{it ? `Senza Smart - anni ${postContract.year}-${r.analysisPeriod}` : `Without Smart - years ${postContract.year}-${r.analysisPeriod}`}</span><strong>{money(postContract.customerSaving)} / {it ? "anno" : "year"}</strong></div>
          <div><span>{it ? `Con Smart - anni ${postContract.year}-${r.analysisPeriod}` : `With Smart - years ${postContract.year}-${r.analysisPeriod}`}</span><strong>{money(postContract.fullSmartNetBenefit)} / {it ? "anno" : "year"}</strong></div>
          <div className={r.fullSmartIncrementalSavings >= 0 ? "positive" : "negative"}><span>{it ? "Beneficio aggiuntivo Smart" : "Additional Smart benefit"}</span><strong>{money(postContract.fullSmartNetBenefit - postContract.customerSaving)} / {it ? "anno" : "year"}<small>{money(r.fullSmartIncrementalSavings)} {it ? "totale" : "total"}</small></strong></div>
          <p>{r.powerAidEnabled ? (it ? "PowerAiD è incluso solo quando genera un risparmio incrementale." : "PowerAiD is included only when it generates incremental savings.") : (it ? "PowerAiD non è incluso nello scenario." : "PowerAiD is not included in the scenario.")}</p>
        </div>
      )}
      {r.cmsEnabled && !postContract && (
        <div className="smart-full-period-note">✓ {it ? `Smart attivo per l'intero periodo di analisi - ${r.analysisPeriod} anni` : `Smart active throughout the full analysis period - ${r.analysisPeriod} years`}</div>
      )}
    </section>
  );
}
function CashTable({ p, r, money }) {
  const allInclusive = r.dealType === "noleggio_operativo";
  const included = p.language === "it" ? "Incluso" : "Included";
  const money2 = (value) =>
    formatMoney(value, p.language, p.project.currency, 2);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {[
              p.language === "it" ? "Anno" : "Year",
              p.language === "it" ? "Beneficio lordo" : "Gross benefit",
              "OPEX",
              allInclusive
                ? p.language === "it"
                  ? "Canone tutto incluso"
                  : "All-inclusive payment"
                : p.language === "it"
                  ? "Pagamento"
                  : "Payment",
              p.language === "it" ? "Flusso netto" : "Net cash flow",
              p.language === "it" ? "Cumulato" : "Cumulative",
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.cashFlowRows.map((x) => (
            <tr key={x.year}>
              <td>{x.year}</td>
              <td>{money(x.grossBenefit)}</td>
              <td>{allInclusive ? included : money2(x.opex)}</td>
              <td>{money2(x.payment)}</td>
              <td>{money(x.netCashFlow)}</td>
              <td>{money(x.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Projects({
  list,
  activeId,
  select,
  remove,
  create,
  importProjectFile,
  t,
}) {
  const language = list[0]?.language || "en";
  return (
    <Card title={t("projects")}>
      <div className="project-list">
        {list.map((p) => (
          <div
            key={p.id}
            className={`project-row ${p.id === activeId ? "selected" : ""}`}
          >
            <button className="project-select" onClick={() => select(p.id)}>
              <strong>{p.project.name}</strong>
              <span>{p.customer.name || "—"}</span>
              <small>{p.project.businessCaseId}</small>
            </button>
            <button
              className="danger project-delete"
              onClick={() => remove(p.id)}
              aria-label={
                language === "it"
                  ? `Elimina ${p.project.name}`
                  : `Delete ${p.project.name}`
              }
            >
              {language === "it" ? "Elimina" : "Delete"}
            </button>
          </div>
        ))}
      </div>
      <div className="import-actions">
        <button className="primary" onClick={create}>
          + {language === "it" ? "Nuovo progetto" : "New project"}
        </button>
        <label className="file-button">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              importProjectFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {language === "it" ? "Importa file progetto" : "Import project file"}
        </label>
      </div>
      <p className="muted">
        {language === "it"
          ? "Riconoscimento automatico: Planner, Noleggio Operativo o file lampade CSV/Excel. Vedrai sempre un'anteprima prima del salvataggio."
          : "Automatic detection: Planner, Noleggio Operativo, or lighting CSV/Excel. A preview is always shown before saving."}
      </p>
    </Card>
  );
}
function Crm({ projects, active, update, money }) {
  const totals = pipelineTotals(projects);
  const stages = pipelineStageTotals(projects);
  const row = crmMetrics(active);
  const probability = (value) =>
    formatProbabilityPoints(value, active.language);
  return (
    <>
      <div className="kpis">
        <Kpi label="Total TCV" value={money(totals.totalContractValue)} />
        <Kpi label="Weighted TCV" value={money(totals.weightedTcv)} />
        <Kpi label="MRR" value={money(totals.monthlyRecurringRevenue)} />
        <Kpi label="ARR" value={money(totals.annualRecurringRevenue)} />
      </div>
      <div className="cards-grid">
        {stages.map((stage) => (
          <Card
            title={stage.stage[0].toUpperCase() + stage.stage.slice(1)}
            key={stage.stage}
          >
            <div className="breakdown">
              <div>
                <span>Projects</span>
                <span></span>
                <strong>{stage.count}</strong>
              </div>
              <div>
                <span>Average probability</span>
                <span></span>
                <strong>{probability(stage.averageProbability)}</strong>
              </div>
              <div>
                <span>Total TCV</span>
                <span></span>
                <strong>{money(stage.totalContractValue)}</strong>
              </div>
              <div>
                <span>Weighted TCV</span>
                <span></span>
                <strong>{money(stage.weightedTcv)}</strong>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card title={`CRM · ${active.project.name}`}>
        <div className="form-grid">
          <Field
            label="Status"
            value={row.status}
            onChange={(v) => update(["crm", "status"], v)}
          >
            <option value="lead">Lead</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="closing">Closing</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </Field>
          <Field
            label="Closing probability (%)"
            value={row.probability}
            onChange={(v) => update(["crm", "closingProbability"], v)}
          />
          <Field
            label="Total Contract Value"
            value={active.crm.totalContractValue ?? ""}
            placeholder={String(row.totalContractValue)}
            onChange={(v) =>
              update(["crm", "totalContractValue"], v === "" ? null : v)
            }
          />
        </div>
        <div className="breakdown">
          <div>
            <span>Weighted TCV = TCV × probability factor</span>
            <span>{probability(row.probability)}</span>
            <strong>{money(row.weightedTcv)}</strong>
          </div>
          <div>
            <span>Recurring revenue (stored separately)</span>
            <span>ARR</span>
            <strong>{money(row.annualRecurringRevenue)}</strong>
          </div>
        </div>
      </Card>
    </>
  );
}
function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function DatekDashboard({ projects, money }) {
  const totals = partnerTotals(projects, "DATEK");
  const forecast = growthForecast(totals.arr);
  return (
    <>
      <div className="kpis">
        <Kpi label="Municipalities" value={totals.municipalities} />
        <Kpi label="Projects" value={totals.projects} />
        <Kpi label="Luminaires" value={totals.luminaires} />
        <Kpi label="LCUs" value={totals.lcus} />
        <Kpi label="Annual CMS revenue" value={money(totals.annualRevenue)} />
        <Kpi label="MRR" value={money(totals.mrr)} />
        <Kpi label="ARR" value={money(totals.arr)} />
        <Kpi
          label="Total CMS contract value"
          value={money(totals.totalContractValue)}
        />
        <Kpi label="Pipeline TCV" value={money(totals.pipelineTcv)} />
        <Kpi label="Weighted TCV" value={money(totals.weightedTcv)} />
      </div>
      <Card title="DATEK Partner Pipeline">
        <PartnerTable rows={totals.rows} money={money} />
      </Card>
      <Card title="Growth forecast · 10% annual">
        <div className="breakdown">
          {forecast.map((x) => (
            <div key={x.year}>
              <span>Year {x.year}</span>
              <span></span>
              <strong>{money(x.arr)}</strong>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
function PartnerTable({ rows, money }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {[
              "Municipality",
              "Project",
              "Luminaires",
              "LCUs",
              "Probability",
              "Pipeline TCV",
              "Weighted TCV",
              "Annual revenue",
              "MRR",
              "ARR",
              "Contract years",
              "Contract value",
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <td>{x.municipality}</td>
              <td>{x.project}</td>
              <td>{x.luminaires}</td>
              <td>{x.lcus || 0}</td>
              <td>{formatProbabilityPoints(x.probability)}</td>
              <td>{money(x.pipelineTcv)}</td>
              <td>{money(x.weightedTcv)}</td>
              <td>{money(x.annualRevenue)}</td>
              <td>{money(x.mrr)}</td>
              <td>{money(x.arr)}</td>
              <td>{x.contractYears}</td>
              <td>{money(x.totalContractValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function PartnerReports({ projects, p, money }) {
  const [scope, setScope] = useState("portfolio");
  const [projectId, setProjectId] = useState(p.id);
  const reportProjects = scope === "project"
    ? projects.filter((project) => project.id === projectId)
    : projects;
  return (
    <div className="cards-grid">
      <Card className="partner-scope-card" title={p.language === "it" ? "Livello report partner" : "Partner report level"}>
        <div className="partner-scope-controls">
          <Field label={p.language === "it" ? "Vista" : "View"} value={scope} onChange={setScope}>
            <option value="portfolio">{p.language === "it" ? "Portafoglio completo" : "Full portfolio"}</option>
            <option value="project">{p.language === "it" ? "Singolo progetto" : "Single project"}</option>
          </Field>
          {scope === "project" && <Field label={p.language === "it" ? "Progetto" : "Project"} value={projectId} onChange={setProjectId}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.customer.name || project.project.name} · {project.project.businessCaseId}</option>)}
          </Field>}
        </div>
      </Card>
      {[
        ["VIMALUX", "VIMALUX"],
        ["DATEK", "DATEK"],
        ["Felicity / PowerAiD", "FELICITY"],
      ].map(([label, key]) => {
        const totals = partnerTotals(reportProjects, key);
        const row = totals.rows[0];
        return (
          <Card title={label} key={key}>
            <div className="breakdown">
              <div>
                <span>Projects</span>
                <span></span>
                <strong>{totals.projects}</strong>
              </div>
              {scope === "project" && row && <>
                <div><span>{p.language === "it" ? "Progetto" : "Project"}</span><span></span><strong>{row.project}</strong></div>
                <div><span>{p.language === "it" ? "Apparecchi" : "Luminaires"}</span><span></span><strong>{row.luminaires}</strong></div>
                <div><span>LCU</span><span></span><strong>{row.lcus || 0}</strong></div>
                <div><span>{p.language === "it" ? "Valore annuo" : "Annual value"}</span><span></span><strong>{money(row.annualRevenue)}</strong></div>
              </>}
              <div>
                <span>Business value</span>
                <span></span>
                <strong>{money(totals.totalContractValue)}</strong>
              </div>
              <div>
                <span>ARR</span>
                <span></span>
                <strong>{money(totals.arr)}</strong>
              </div>
            </div>
            <button
              className="primary"
              onClick={() =>
                generatePartnerPdf(
                  key,
                  reportProjects,
                  p.language,
                  p.project.currency,
                )
              }
            >
              {p.language === "it" ? "Genera report" : "Generate report"}
            </button>
          </Card>
        );
      })}
    </div>
  );
}
function Catalogue({ p, update }) {
  const it = p.language === "it";
  const addLed = () =>
    update(
      ["catalogue", "led"],
      [
        ...p.catalogue.led,
        {
          id: `led-${uid()}`,
          brand: "",
          name: it ? "Nuovo prodotto LED" : "New LED product",
          wattage: 0,
          lumen: 0,
          costPrice: 0,
          salesPrice: 0,
          active: true,
        },
      ],
    );
  const addSmart = () =>
    update(
      ["catalogue", "smart"],
      [
        ...p.catalogue.smart,
        {
          id: `smart-${uid()}`,
          brand: "",
          name: it ? "Nuovo prodotto Smart" : "New Smart product",
          type: "LCU",
          costPrice: 0,
          salesPrice: 0,
          implementationCost: 0,
          implementationSalesPrice: 0,
          annualCost: 0,
          annualSalesPrice: 0,
          active: true,
        },
      ],
    );
  const remove = (kind, index) => {
    if (
      confirm(
        it
          ? "Eliminare questo prodotto dal catalogo?"
          : "Delete this product from the catalogue?",
      )
    )
      update(
        ["catalogue", kind],
        p.catalogue[kind].filter((_, i) => i !== index),
      );
  };
  const renderLed = (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {[
              "Brand",
              it ? "Prodotto" : "Product",
              "W",
              "lm",
              it ? "Costo" : "Cost",
              it ? "Prezzo standard" : "Standard sales",
              it ? "Attivo" : "Active",
              "",
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.catalogue.led.map((x, i) => (
            <tr key={x.id}>
              <td>
                <input
                  value={x.brand}
                  onChange={(e) =>
                    update(["catalogue", "led", i, "brand"], e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  value={x.name}
                  onChange={(e) =>
                    update(["catalogue", "led", i, "name"], e.target.value)
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.wattage}
                  onChange={(v) =>
                    update(["catalogue", "led", i, "wattage"], v)
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.lumen}
                  onChange={(v) => update(["catalogue", "led", i, "lumen"], v)}
                />
              </td>
              <td>
                <NumericInput
                  value={x.costPrice}
                  onChange={(v) =>
                    update(["catalogue", "led", i, "costPrice"], v)
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.salesPrice}
                  onChange={(v) =>
                    update(["catalogue", "led", i, "salesPrice"], v)
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={x.active}
                  onChange={(e) =>
                    update(["catalogue", "led", i, "active"], e.target.checked)
                  }
                />
              </td>
              <td>
                <button className="danger" onClick={() => remove("led", i)}>
                  {it ? "Elimina" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const renderSmart = (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {[
              "Brand",
              it ? "Prodotto" : "Product",
              it ? "Tipo" : "Type",
              it ? "Costo" : "Cost",
              it ? "Prezzo standard" : "Standard sales",
              it ? "Costo implementazione" : "Implementation cost",
              it ? "Prezzo implementazione" : "Implementation sales",
              it ? "Costo annuo" : "Annual cost",
              it ? "Prezzo annuo cliente" : "Annual customer sales",
              it ? "Attivo" : "Active",
              "",
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.catalogue.smart.map((x, i) => (
            <tr key={x.id}>
              <td>
                <input
                  value={x.brand}
                  onChange={(e) =>
                    update(["catalogue", "smart", i, "brand"], e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  value={x.name}
                  onChange={(e) =>
                    update(["catalogue", "smart", i, "name"], e.target.value)
                  }
                />
              </td>
              <td>
                <select
                  value={x.type}
                  onChange={(e) =>
                    update(["catalogue", "smart", i, "type"], e.target.value)
                  }
                >
                  {["LCU", "Gateway", "Antenna", "Energy Meter", "Other"].map(
                    (type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ),
                  )}
                </select>
              </td>
              <td>
                <NumericInput
                  value={x.costPrice}
                  onChange={(v) =>
                    update(["catalogue", "smart", i, "costPrice"], v)
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.salesPrice}
                  onChange={(v) =>
                    update(["catalogue", "smart", i, "salesPrice"], v)
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.implementationCost}
                  onChange={(v) =>
                    update(["catalogue", "smart", i, "implementationCost"], v)
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.implementationSalesPrice}
                  onChange={(v) =>
                    update(
                      ["catalogue", "smart", i, "implementationSalesPrice"],
                      v,
                    )
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.annualCost}
                  onChange={(v) =>
                    update(["catalogue", "smart", i, "annualCost"], v)
                  }
                />
              </td>
              <td>
                <NumericInput
                  value={x.annualSalesPrice}
                  onChange={(v) =>
                    update(["catalogue", "smart", i, "annualSalesPrice"], v)
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={x.active}
                  onChange={(e) =>
                    update(
                      ["catalogue", "smart", i, "active"],
                      e.target.checked,
                    )
                  }
                />
              </td>
              <td>
                <button className="danger" onClick={() => remove("smart", i)}>
                  {it ? "Elimina" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <Card title="LED">
        {renderLed}
        <button className="primary" onClick={addLed}>
          + {it ? "Nuovo prodotto LED" : "New LED product"}
        </button>
      </Card>
      <Card title="Smart Lighting">
        {renderSmart}
        <button className="primary" onClick={addSmart}>
          + {it ? "Nuovo prodotto Smart" : "New Smart product"}
        </button>
      </Card>
    </>
  );
}
function Admin({ p, r, setView, reset, t }) {
  const it = p.language === "it";
  const activeLed = p.catalogue.led.filter((product) => product.active).length;
  const activeSmart = p.catalogue.smart.filter(
    (product) => product.active,
  ).length;
  const overrides = p.groups.filter(
    (group) => group.projectLedPrice != null,
  ).length;
  return (
    <>
      <Card title={t("priceAdmin")}>
        <p className="hint">
          {it
            ? "Gestisci i prezzi standard del catalogo e i prezzi specifici del progetto attivo."
            : "Manage standard catalogue prices and project-specific prices for the active project."}
        </p>
        <div className="admin-grid">
          <div className="admin-tile">
            <span>{t("catalogue")}</span>
            <strong>
              {activeLed} LED · {activeSmart} Smart
            </strong>
            <p>
              {it
                ? "Costi, prezzi di vendita, implementazione e canoni annuali."
                : "Costs, sales prices, implementation and annual fees."}
            </p>
            <button className="primary" onClick={() => setView("catalogue")}>
              {it ? "Apri catalogo" : "Open catalogue"}
            </button>
          </div>
          <div className="admin-tile">
            <span>{t("pricing")}</span>
            <strong>
              {overrides} {it ? "prezzi personalizzati" : "custom prices"}
            </strong>
            <p>
              {it
                ? "Assegna prezzi di progetto senza modificare il catalogo principale."
                : "Set project prices without changing the master catalogue."}
            </p>
            <button className="primary" onClick={() => setView("pricing")}>
              {it ? "Apri prezzi progetto" : "Open project pricing"}
            </button>
          </div>
          <div className="admin-tile">
            <span>{t("projects")}</span>
            <strong>{p.project.businessCaseId}</strong>
            <p>
              {it
                ? "Controlla il progetto attivo prima di modificare i prezzi."
                : "Check the active project before changing prices."}
            </p>
            <button className="primary" onClick={() => setView("projects")}>
              {it ? "Apri progetti" : "Open projects"}
            </button>
          </div>
        </div>
      </Card>
      <Card title={it ? "Ripristino dati" : "Data reset"}>
        <p className="hint">
          {it
            ? "Operazione distruttiva: elimina i dati locali e ripristina i valori iniziali."
            : "Destructive action: deletes local data and restores initial values."}
        </p>
        <button className="danger" onClick={reset}>
          {t("reset")}
        </button>
      </Card>
    </>
  );
}
