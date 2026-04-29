import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/*
V31 – ITALIAN ROI FIX ENGINE
Single file App.jsx
*/

export default function App() {
  const fileRef = useRef(null);

  const [lang] = useState("it");
  const [admin, setAdmin] = useState(false);
  const [selected, setSelected] = useState("smart");

  const [qty, setQty] = useState(700);
  const [oldWatt, setOldWatt] = useState(128.6);

  const [auditName, setAuditName] = useState("");

  const [ass, setAss] = useState({
    energyPrice: 0.29,
    burningHours: 4200,
    ledSavingPct: 55,
    smartSolutionSavingPct: 20,
    cloSavingPct: 10,
    maintenanceOldPerLamp: 25,
    maintenanceSavingPct: 50,
    smartNodeCost: 62,
    cmsFeePerLampYear: 6,
    powerAidFeePerLampYear: 3,
    powerAidAdditionalSavingPct: 35,
    years: 10
  });

  const [products, setProducts] = useState([
    { name: "VIMALUX Street 60", watt: 60, sell: 155, install: 35 },
    { name: "VIMALUX Road 90", watt: 90, sell: 210, install: 40 },
    { name: "VIMALUX Highway 120", watt: 120, sell: 285, install: 45 }
  ]);

  const [productIndex, setProductIndex] = useState(0);

  const product = products[productIndex];

  const euro = (n) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(n);

  const num = (n, d = 1) =>
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    }).format(n);

  function updateAss(key, val) {
    setAss((s) => ({ ...s, [key]: parseFloat(String(val).replace(",", ".")) || 0 }));
  }

  function updateProduct(i, key, val) {
    const arr = [...products];
    arr[i][key] =
      key === "name"
        ? val
        : parseFloat(String(val).replace(",", ".")) || 0;
    setProducts(arr);
  }

  function importAudit(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let totalQty = 0;
        let weightedWatt = 0;

        for (let r = 0; r < Math.min(rows.length, 29); r++) {
          const row = rows[r] || [];

          for (let c = 0; c < row.length - 1; c++) {
            const a = parseFloat(row[c]);
            const b = parseFloat(row[c + 1]);

            if (!isNaN(a) && !isNaN(b)) {
              if (a <= 1000 && b <= 1000) {
                const watt = a;
                const q = b;

                if (watt > 10 && q > 0) {
                  totalQty += q;
                  weightedWatt += watt * q;
                }
              }
            }
          }
        }

        if (totalQty > 0) {
          setQty(Math.round(totalQty));
          setOldWatt(weightedWatt / totalQty);
          setAuditName(file.name);
        } else {
          alert("Import fallito");
        }
      } catch {
        alert("Errore file");
      }
    };

    reader.readAsBinaryString(file);
  }

  const calc = useMemo(() => {
    const yearlyOldKwh = (qty * oldWatt * ass.burningHours) / 1000;
    const yearlyOldCost = yearlyOldKwh * ass.energyPrice;

    const newKwh = (qty * product.watt * ass.burningHours) / 1000;
    const newCost = newKwh * ass.energyPrice;

    const ledSaving = yearlyOldCost - newCost;

    const cloSaving = newCost * (ass.cloSavingPct / 100);

    const smartSaving = newCost * (ass.smartSolutionSavingPct / 100);

    const maintSaving =
      qty *
      ass.maintenanceOldPerLamp *
      (ass.maintenanceSavingPct / 100);

    const powerAidSaving =
      (newCost - cloSaving - smartSaving) *
      (ass.powerAidAdditionalSavingPct / 100);

    const ledCapex = qty * (product.sell + product.install);
    const smartCapex = ledCapex + qty * ass.smartNodeCost;

    const ledAnnual = ledSaving;

    const smartAnnual =
      ledSaving +
      cloSaving +
      smartSaving +
      maintSaving -
      qty * ass.cmsFeePerLampYear;

    const premiumAnnual =
      smartAnnual +
      powerAidSaving -
      qty * ass.powerAidFeePerLampYear;

    return {
      led: {
        capex: ledCapex,
        annual: ledAnnual,
        payback: ledCapex / ledAnnual,
        ten: ledAnnual * ass.years
      },
      smart: {
        capex: smartCapex,
        annual: smartAnnual,
        payback: smartCapex / smartAnnual,
        ten: smartAnnual * ass.years
      },
      premium: {
        capex: smartCapex,
        annual: premiumAnnual,
        payback: smartCapex / premiumAnnual,
        ten: premiumAnnual * ass.years
      }
    };
  }, [qty, oldWatt, ass, product]);

  function makePdf() {
    const c = calc[selected];
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("VIMALUX Offerta Smart Lighting", 14, 18);

    doc.setFontSize(11);
    doc.text(`Pacchetto: ${selected}`, 14, 30);
    doc.text(`Quantità: ${qty}`, 14, 38);
    doc.text(`Potenza media esistente: ${num(oldWatt)} W`, 14, 46);
    doc.text(`Prodotto: ${product.name}`, 14, 54);

    autoTable(doc, {
      startY: 65,
      head: [["Voce", "Valore"]],
      body: [
        ["CAPEX", euro(c.capex)],
        ["Risparmio annuo", euro(c.annual)],
        ["Payback", num(c.payback) + " anni"],
        ["Valore 10 anni", euro(c.ten)]
      ]
    });

    doc.save("Offerta_Vimalux.pdf");
  }

  function Card({ id, title, blue }) {
    const c = calc[id];
    const active = selected === id;

    return (
      <div
        onClick={() => setSelected(id)}
        style={{
          flex: 1,
          padding: 18,
          borderRadius: 18,
          cursor: "pointer",
          border: active ? "2px solid #2563eb" : "1px solid #dbe3ef",
          background: active ? "#eef5ff" : "#fff"
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 800 }}>{title}</div>
        <div style={{ marginTop: 14 }}>CAPEX {euro(c.capex)}</div>
        <div>Payback {num(c.payback)} anni</div>
        <div style={{ marginTop: 10, color: "#059669", fontWeight: 700 }}>
          10Y {euro(c.ten)}
        </div>
      </div>
    );
  }

  const sel = calc[selected];

  return (
    <div
      style={{
        background: "#f3f6fb",
        minHeight: "100vh",
        padding: 18,
        fontFamily: "Arial"
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 18,
          borderRadius: 18,
          marginBottom: 18
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 800 }}>
          VIMALUX Lighting AI Portal
        </div>
        <div style={{ color: "#64748b", fontSize: 24 }}>
          Versione 31 – Italian ROI Fix Engine
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button onClick={() => setAdmin(!admin)}>Admin</button>
          <button onClick={makePdf}>PDF Proposta</button>
          <button onClick={() => fileRef.current.click()}>
            Import Audit Sheet
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={importAudit}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
        <Card id="led" title="LED Only" />
        <Card id="smart" title="Smart CMS" />
        <Card id="premium" title="Smart + PowerAiD" />
      </div>

      <div
        style={{
          background: "#fff",
          padding: 18,
          borderRadius: 18,
          marginBottom: 18
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700 }}>Dati progetto</div>
        <div style={{ marginTop: 10 }}>Audit file: {auditName || "-"}</div>
        <div>Quantità: {qty}</div>
        <div>Watt medio esistente: {num(oldWatt)} W</div>
        <div>Prodotto scelto: {product.name}</div>
      </div>

      <div
        style={{
          background: "#fff",
          padding: 18,
          borderRadius: 18,
          marginBottom: 18
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700 }}>KPI</div>
        <div style={{ marginTop: 10 }}>CAPEX: {euro(sel.capex)}</div>
        <div>Risparmio annuo: {euro(sel.annual)}</div>
        <div>Payback: {num(sel.payback)} anni</div>
        <div>Valore 10 anni: {euro(sel.ten)}</div>
      </div>

      {admin && (
        <div
          style={{
            background: "#fff",
            padding: 18,
            borderRadius: 18
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 14 }}>
            Admin Assunzioni
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {Object.keys(ass).map((k) => (
              <input
                key={k}
                value={ass[k]}
                onChange={(e) => updateAss(k, e.target.value)}
                placeholder={k}
                style={{ padding: 10 }}
              />
            ))}
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 20,
              marginBottom: 12
            }}
          >
            Product Override
          </div>

          {products.map((p, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: 8,
                marginBottom: 8
              }}
            >
              <input
                value={p.name}
                onChange={(e) => updateProduct(i, "name", e.target.value)}
              />
              <input
                value={p.watt}
                onChange={(e) => updateProduct(i, "watt", e.target.value)}
              />
              <input
                value={p.sell}
                onChange={(e) => updateProduct(i, "sell", e.target.value)}
              />
              <input
                value={p.install}
                onChange={(e) => updateProduct(i, "install", e.target.value)}
              />
            </div>
          ))}

          <select
            value={productIndex}
            onChange={(e) => setProductIndex(Number(e.target.value))}
            style={{ marginTop: 12, padding: 10 }}
          >
            {products.map((p, i) => (
              <option key={i} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
