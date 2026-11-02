import React from "react";
import { CUSTOMER_VAT_TYPES, normalizeCustomerVatType } from "./customerVatProfile.js";

export default function AgentCustomerType({ project, update, disabled = false }) {
  const it = project.language === "it";
  return <label><span>{it ? "Tipo cliente" : "Customer type"}</span>
    <select disabled={disabled} value={normalizeCustomerVatType(project.customer?.customerType)}
      onChange={event => update(["customer", "customerType"], event.target.value)}>
      {CUSTOMER_VAT_TYPES.map(item => <option key={item.id} value={item.id}>{it ? item.it : item.en}</option>)}
    </select>
  </label>;
}
