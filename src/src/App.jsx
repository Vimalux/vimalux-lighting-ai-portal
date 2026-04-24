import React from "react";

export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f6f8",
      fontFamily: "Arial, sans-serif",
      padding: "40px",
      color: "#0b1220"
    }}>
      <div style={{maxWidth:"1200px",margin:"0 auto"}}>
        <div style={{
          background:"#07111f",
          color:"white",
          padding:"40px",
          borderRadius:"24px",
          marginBottom:"30px"
        }}>
          <div style={{letterSpacing:"2px",fontSize:"12px",color:"#93c5fd"}}>
            VIMALUX LIGHTING AI PORTAL
          </div>

          <h1 style={{
            fontSize:"58px",
            margin:"15px 0"
          }}>
            Smart LED replacement engine
          </h1>

          <p style={{
            fontSize:"22px",
            color:"#dbeafe"
          }}>
            Digital catalogue, ROI dashboard and investor-ready proposal.
          </p>
        </div>

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(4,1fr)",
          gap:"20px"
        }}>
          {[
            ["Total lamps","910"],
            ["Estimated CAPEX","€166,800"],
            ["Annual net saving","€85,212"],
            ["Simple payback","2.0 years"],
            ["15Y net value","€1,111,384"],
            ["Smart uplift","€10,965"],
            ["CO2 saving/year","99 t"],
            ["Investor value proxy","€681,698"]
          ].map((k,i)=>(
            <div key={i} style={{
              background:"white",
              padding:"25px",
              borderRadius:"22px"
            }}>
              <div style={{fontSize:"14px",color:"#64748b"}}>
                {k[0]}
              </div>
              <div style={{
                marginTop:"12px",
                fontSize:"42px",
                fontWeight:"bold"
              }}>
                {k[1]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
