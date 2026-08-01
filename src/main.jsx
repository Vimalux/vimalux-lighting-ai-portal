import React from "react";
import ReactDOM from "react-dom/client";
import AppFinalEngine from "./AppFinalEngine.jsx";
import "./v31RuntimeEnhancements.js";
import "./v32ProposalPolish.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppFinalEngine />
  </React.StrictMode>
);
