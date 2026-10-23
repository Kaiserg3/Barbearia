import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { enablePreviewApi } from "./preview-api.js";

if (window.__BRAVO_STANDALONE__) {
  enablePreviewApi(window.__BRAVO_PREVIEW_CATALOG__);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
