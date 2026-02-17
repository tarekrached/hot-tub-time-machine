/** @jsxImportSource https://esm.sh/react@18.3.1 */
import React, { useState, useEffect, useCallback } from "https://esm.sh/react@18.3.1";
import type { DashboardData } from "../../shared/types.ts";
import Dashboard from "./Dashboard.tsx";
import TestSession from "./TestSession.tsx";
import TestHistory from "./TestHistory.tsx";
import MaintenanceLog from "./MaintenanceLog.tsx";
import DosingCalculator from "./DosingCalculator.tsx";

type Tab = "dashboard" | "test" | "history" | "maintenance" | "dosing";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(
    (window as any).__INITIAL_DATA__ || null
  );

  const refreshDashboard = useCallback(async () => {
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    setDashboard(data);
  }, []);

  useEffect(() => {
    if (!dashboard) refreshDashboard();
  }, []);

  const handleStartTest = () => setTab("test");

  const handleTestComplete = () => {
    refreshDashboard();
    setTab("dashboard");
  };

  const handleMaintenanceLogged = () => {
    refreshDashboard();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Hot Tub Time Machine</h1>
      </header>

      <main className="app-main">
        {tab === "dashboard" && (
          <Dashboard
            data={dashboard}
            onStartTest={handleStartTest}
            onRefresh={refreshDashboard}
          />
        )}
        {tab === "test" && (
          <TestSession
            suggestedTests={dashboard?.suggestedTests || ["ph", "bromine"]}
            onComplete={handleTestComplete}
            onCancel={() => setTab("dashboard")}
          />
        )}
        {tab === "history" && <TestHistory />}
        {tab === "maintenance" && (
          <MaintenanceLog onLogged={handleMaintenanceLogged} />
        )}
        {tab === "dosing" && <DosingCalculator />}
      </main>

      <nav className="tab-bar">
        <button
          className={`tab-btn ${tab === "dashboard" ? "active" : ""}`}
          onClick={() => setTab("dashboard")}
        >
          <span className="tab-icon">&#9678;</span>
          <span className="tab-label">Home</span>
        </button>
        <button
          className={`tab-btn ${tab === "test" ? "active" : ""}`}
          onClick={() => setTab("test")}
        >
          <span className="tab-icon">&#9874;</span>
          <span className="tab-label">Test</span>
        </button>
        <button
          className={`tab-btn ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          <span className="tab-icon">&#9776;</span>
          <span className="tab-label">History</span>
        </button>
        <button
          className={`tab-btn ${tab === "maintenance" ? "active" : ""}`}
          onClick={() => setTab("maintenance")}
        >
          <span className="tab-icon">&#9881;</span>
          <span className="tab-label">Maint.</span>
        </button>
        <button
          className={`tab-btn ${tab === "dosing" ? "active" : ""}`}
          onClick={() => setTab("dosing")}
        >
          <span className="tab-icon">&#9878;</span>
          <span className="tab-label">Dosing</span>
        </button>
      </nav>
    </div>
  );
}
