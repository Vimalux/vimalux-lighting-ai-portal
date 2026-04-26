import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";

export default function App() {
  const [client, setClient] = useState("Comune Demo");

  const [rows, setRows] = useState([
    { id: 1, area: "Main roads", qty: 320, oldWatt: 150, hours: 4200 },
    { id: 2, area: "Urban roads", qty: 500, oldWatt: 120, hours: 4200 }
  ]);

  const [energyPrice, setEnergyPrice] = useState(0.29);
  const [maintenanceCost, setMaintenanceCost] = useState(25);

  const [packageType, setPackageType] = useState("premium");
  // led / smart / premium

  const products = [
    { name: "VIMALUX Street Pro 60W Smart", watt: 60, sell: 150, install: 45 },
    { name: "VIMALUX Urban 45W Smart", watt: 45, sell: 135, install: 45 },
    { name: "VIMALUX Main Road 90W Smart", watt: 90, sell: 185, install: 50 }
  ];

  function eur(v) {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(v || 0);
  }

  function num(v) {
    return new Intl.NumberFormat("en-IE", {
      maximumFractionDigits: 0
    }).format(v || 0);
  }

  async function importExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const parsed = json.map((r, i) => ({
      id: i + 1,
      area: r.Area || r.area || r.Zone || `Line ${i + 1}`,
      qty: Number(r.Qty || r.qty || r.Quantity || 1),
      oldWatt: Number(r.Watt || r.watt || r.Power || 100),
      hours: Number(r.Hours || r.hours || 4200)
    }));

    setRows(parsed);
    setClient(file.name.replace(".xlsx", "").replace(".xls", ""));
  }

  const calc = useMemo(() => {
    const totalLamps = rows.reduce((a, b) => a + b.qty, 0);

    const existingKwh = rows.reduce(
      (a, b) => a + (b.qty * b.oldWatt * b.hours) / 1000,
      0
    );

    const ledKwh = existingKwh * 0.5;

    let smartExtraSaving = 0;
    let annualFeePerLamp = 0;

    if (packageType === "smart") {
      smartExtraSaving = 20;
      annualFeePerLamp = 6;
    }

    if (packageType === "premium") {
      smartExtraSaving = 30;
      annualFeePerLamp = 9;
    }

    const finalKwh = ledKwh * (1 - smartExtraSaving / 100);

    const energySavingEuro = (existingKwh - finalKwh) * energyPrice;

    const maintenanceSaving =
      totalLamps * maintenanceCost * 0.75;

    const annualFee = totalLamps * annualFeePerLamp;

    const annualNetSaving =
      energySavingEuro + maintenanceSaving - annualFee;

    const capex = totalLamps * 195;

    const payback = capex / annualNetSaving;

    const roi = (annualNetSaving / capex) * 100;

    return {
      totalLamps,
      existingKwh,
      finalKwh,
      annualFee,
      annualNetSaving,
      capex,
      payback,
      roi
    };
  }, [rows, energyPrice, maintenanceCost, packageType]);

  const box = {
    background: "white",
    borderRadius: 24,
    padding: 26
  };

  const btn = (active) => ({
    padding: "14px 18px",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    background: active ? "#08162d" : "#dde4ee",
    color: active ? "white" : "#08162d"
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eef1f5",
        padding: 28,
        fontFamily: "Arial, sans-serif",
        color: "#08162d"
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 28 }}>
        {/* Sidebar */}
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 4,
              marginBottom: 28
            }}
          >
            VIMALUX
          </div>

          {[
            "Import Excel",
            "Dashboard",
            "Packages",
            "Proposal",
            "Investor"
          ].map((x, i) => (
            <div
              key={x}
              style={{
                padding: "18px 20px",
                borderRadius: 18,
                marginBottom: 12,
                background: i === 1 ? "#08162d" : "transparent",
                color: i === 1 ? "white" : "#08162d",
                fontWeight: 800
              }}
            >
              {x}
            </div>
          ))}
        </div>

        {/* Main */}
        <div>
          <div
            style={{
              background: "#03122a",
              color: "white",
              borderRadius: 34,
              padding: 42,
              marginBottom: 24
            }}
          >
            <div style={{ fontSize: 18, letterSpacing: 3 }}>
              VIMALUX LIGHTING AI PORTAL · VERSION 9A
            </div>

            <div
              style={{
                fontSize: 68,
                fontWeight: 900,
                marginTop: 10
              }}
            >
              Subscription Closing Engine
            </div>

            <div style={{ fontSize: 22, marginTop: 12 }}>
              LED vs Smart vs Premium live ROI comparison.
            </div>

            <div style={{ marginTop: 24 }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={importExcel}
              />
            </div>
          </div>

          {/* Package buttons */}
          <div
            style={{
              ...box,
              marginBottom: 24
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                marginBottom: 18
              }}
            >
              Select commercial package
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                style={btn(packageType === "led")}
                onClick={() => setPackageType("led")}
              >
                LED only (€0/year)
              </button>

              <button
                style={btn(packageType === "smart")}
                onClick={() => setPackageType("smart")}
              >
                Smart (€6/lamp/year)
              </button>

              <button
                style={btn(packageType === "premium")}
                onClick={() => setPackageType("premium")}
              >
                Premium (€9/lamp/year)
              </button>
            </div>
          </div>

          {/* KPI */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 22
            }}
          >
            <div style={box}>
              <div>Client</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>{client}</div>
            </div>

            <div style={box}>
              <div>Total lamps</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {num(calc.totalLamps)}
              </div>
            </div>

            <div style={box}>
              <div>Total project CAPEX</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {eur(calc.capex)}
              </div>
            </div>

            <div style={box}>
              <div>Annual net saving</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {eur(calc.annualNetSaving)}
              </div>
            </div>

            <div style={box}>
              <div>Annual software fee</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {eur(calc.annualFee)}
              </div>
            </div>

            <div style={box}>
              <div>Customer ROI/year</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {calc.roi.toFixed(1)}%
              </div>
            </div>

            <div style={box}>
              <div>Simple payback</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {calc.payback.toFixed(1)} years
              </div>
            </div>

            <div style={box}>
              <div>Existing consumption</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {num(calc.existingKwh)} kWh
              </div>
            </div>

            <div style={box}>
              <div>New consumption</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {num(calc.finalKwh)} kWh
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
