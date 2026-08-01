import React from "react";
import ReactDOM from "react-dom/client";
import AppBusinessCaseV1 from "./AppBusinessCaseV1.jsx";
import "./safeLanguageSelector.js";

// Remove only invalid cached JSON before the application initializes.
for (const key of ["vml-bc-led", "vml-bc-smart", "vml-bc-projects"]) {
  const value = localStorage.getItem(key);
  if (value) {
    try {
      JSON.parse(value);
    } catch {
      localStorage.removeItem(key);
    }
  }
}

class RuntimeBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("VIMALUX application runtime error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ fontFamily: "Arial, sans-serif", padding: 32 }}>
          <h1>VIMALUX Intelligence</h1>
          <p>Application data could not be loaded.</p>
          <button
            type="button"
            onClick={() => {
              for (const key of ["vml-bc-led", "vml-bc-smart", "vml-bc-projects", "vml-bc-active"]) {
                localStorage.removeItem(key);
              }
              window.location.reload();
            }}
          >
            Reset local project cache and reload
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <RuntimeBoundary>
    <AppBusinessCaseV1 />
  </RuntimeBoundary>
);
