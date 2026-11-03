import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(<App />);

// Browser prints document.title in the page header ("Billing Entry · Franch Express Courier").
// Blank it only while the print dialog is open so it never shows above the bill.
let savedTitle = document.title;
window.addEventListener("beforeprint", () => { savedTitle = document.title; document.title = "​"; });
window.addEventListener("afterprint", () => { document.title = savedTitle; });
