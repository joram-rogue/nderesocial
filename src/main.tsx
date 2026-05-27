import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SplashScreen } from "@capacitor/splash-screen";

// Apply saved theme before render to avoid flash
const saved = localStorage.getItem("ndere.theme");
if (saved === "midnight") document.documentElement.classList.add("theme-midnight");

createRoot(document.getElementById("root")!).render(<App />);

SplashScreen.hide();
