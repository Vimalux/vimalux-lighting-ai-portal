import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";

export default function App() {
  const [rows, setRows] = useState([]);
  const [client, setClient] = useState("Imported Municipality");

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

  const candidateSheets = [
    wb.Sheets["ProjectInputSheet"],
    wb.Sheets["ProjectInputSheet_ITA"],
    wb.Sheets[wb.SheetNames[0]]
  ].filter(Boolean);

  let bestRows = [];

  for (const ws of candidateSheets) {
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const parsed = matrix
      .slice(14)
      .map((r, i) => ({
        id: Date.now() + i,
        area: r[1] || `Line ${i + 1}`,
        qty: Number(r[3] || 0),
        oldWatt: Number(r[6] || 0)
      }))
      .filter(r => r.qty > 0 && r.oldWatt > 0);

    if (parsed.length > bestRows.length) {
      bestRows = parsed;
    }
  }

  if (bestRows.length) {
    setRows(bestRows);
    setClient(file.name.replace(".xlsx", "").replace(".xls", ""));
  } else {
    alert("No valid VIMALUX audit rows found. Check quantity in column D and wattage in column G.");
  }
  const calc = useMemo(() => {
    const totalLamps = rows.reduce((a, b) => a + b.qty, 0);

    const existingKwh = rows.reduce(
      (a, b) => a + b.qty * b.oldWatt * 4200 / 1000,
      0
    );

    const ledKwh = existingKwh * 0.5;
    const smartKwh = ledKwh * 0.78;

    const annualSaving = (existingKwh - smartKwh) * 0.27;
    const capex = totalLamps * 195;
    const payback = capex / annualSaving;

    return {
      totalLamps,
      existingKwh,
      smartKwh,
      annualSaving,
      capex,
      payback
    };
  }, [rows]);

  const box = {
    background: "white",
    borderRadius: 24,
    padding: 28
  };

  const label = {
    color: "#5c6f8e",
    fontSize: 16
  };

  const value = {
    fontSize: 36,
    fontWeight: 800,
    marginTop: 10
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eef1f5",
        fontFamily: "Arial, sans-serif",
        color: "#08162d",
        padding: 28
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
            "Revenue",
            "Calculator",
            "Proposal",
            "Financing",
            "Import Excel",
            "Investor",
            "Leads"
          ].map((x, i) => (
            <div
              key={x}
              style={{
                padding: "18px 22px",
                marginBottom: 12,
                borderRadius: 18,
                background: i === 4 ? "#08162d" : "transparent",
                color: i === 4 ? "white" : "#08162d",
                fontWeight: 800,
                fontSize: 18
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
              marginBottom: 26
            }}
          >
            <div style={{ letterSpacing: 3, fontSize: 18 }}>
              VIMALUX LIGHTING AI PORTAL · VERSION 6B
            </div>

            <div
              style={{
                fontSize: 72,
                fontWeight: 900,
                marginTop: 12
              }}
            >
              Closing Machine
            </div>

            <div style={{ fontSize: 22, marginTop: 12 }}>
              Native Excel import of real client audit sheets.
            </div>

            <div style={{ marginTop: 28 }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={importExcel}
                style={{
                  background: "white",
                  padding: 14,
                  borderRadius: 12,
                  fontWeight: 700
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 22
            }}
          >
            <div style={box}>
              <div style={label}>Client</div>
              <div style={value}>{client}</div>
            </div>

            <div style={box}>
              <div style={label}>Total lamps</div>
              <div style={value}>{num(calc.totalLamps)}</div>
            </div>

            <div style={box}>
              <div style={label}>Estimated CAPEX</div>
              <div style={value}>{eur(calc.capex)}</div>
            </div>

            <div style={box}>
              <div style={label}>Existing consumption</div>
              <div style={value}>{num(calc.existingKwh)} kWh</div>
            </div>

            <div style={box}>
              <div style={label}>Smart consumption</div>
              <div style={value}>{num(calc.smartKwh)} kWh</div>
            </div>

            <div style={box}>
              <div style={label}>Annual saving</div>
              <div style={value}>{eur(calc.annualSaving)}</div>
            </div>

            <div style={box}>
              <div style={label}>Simple payback</div>
              <div style={value}>
                {isFinite(calc.payback)
                  ? calc.payback.toFixed(1) + " years"
                  : "-"}
              </div>
            </div>
          </div>

          <div style={{ ...box, marginTop: 24 }}>
            <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 14 }}>
              Imported rows preview
            </div>

            {rows.slice(0, 10).map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr",
                  padding: "10px 0",
                  borderBottom: "1px solid #dde3ea"
                }}
              >
                <div>{r.area}</div>
                <div>{r.qty} pcs</div>
                <div>{r.oldWatt} W</div>
              </div>
            ))}

            {rows.length === 0 && (
              <div style={{ color: "#6c7b92" }}>
                Upload client Excel file now.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
