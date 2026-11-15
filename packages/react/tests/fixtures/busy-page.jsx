import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Threadmark } from "../../src/index.jsx";
import * as targets from "../../src/target.js";

window.__threadmarkDomPaths = { buildDomPath: targets.buildDomPath, queryDomPath: targets.queryDomPath };

// A page shaped like a real app: a large table, a clock that re-renders four times a second,
// a CSS animation, and background requests and console output. `?rows=` sets the table size,
// `?replay=1` turns session replay on.
const params = new URLSearchParams(window.location.search);
const ROWS = Number(params.get("rows")) || 1500;
const sessionReplay = params.has("replay") ? { bufferMs: 30_000 } : undefined;
const rows = Array.from({ length: ROWS }, (_, index) => ({
  id: index,
  name: `Customer ${index} ${["Okafor", "Mendes", "Lindqvist", "Tanaka", "Haddad"][index % 5]}`,
  plan: ["Starter", "Team", "Business", "Enterprise"][index % 4],
  seats: (index * 7) % 120,
  status: index % 9 === 0 ? "Overdue" : "Active",
  amount: `$${((index * 37) % 9000) / 10}`,
}));

window.__threadmarkFeedback = [];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(timer);
  }, []);
  return <span id="clock">{now.toISOString()}</span>;
}

function Fixture() {
  const [annotations, setAnnotations] = useState([]);
  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/poll?cursor=1").catch(() => {});
      console.info("poll", Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { window.__threadmarkSetRecords = setAnnotations; }, []);
  return (
    <>
      <header style={{ display: "flex", gap: 16, padding: 16, alignItems: "center" }}>
        <strong id="brand">Ledger</strong>
        <nav>{["Overview", "Customers", "Invoices", "Reports", "Settings"].map((label) => <a key={label} href={`#${label}`} style={{ marginRight: 12 }}>{label}</a>)}</nav>
        <Clock />
        <div className="spinner" aria-label="Syncing" />
      </header>
      <main style={{ padding: 16 }}>
        <h1 id="title">Customers</h1>
        <button id="primary-action" type="button">Add customer</button>
        <table id="customers">
          <thead><tr><th>Name</th><th>Plan</th><th>Seats</th><th>Status</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-row={row.id}>
                <td><span className="name">{row.name}</span></td>
                <td>{row.plan}</td>
                <td>{row.seats}</td>
                <td><span className={`badge badge--${row.status.toLowerCase()}`}>{row.status}</span></td>
                <td>{row.amount}</td>
                <td><button type="button">Edit</button> <button type="button">Archive</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
      <Threadmark
        enabled
        environment="local"
        projectKey="busy-page"
        reviewer={{ id: "perf_reviewer", displayName: "Emily R." }}
        sessionReplay={sessionReplay}
        annotations={annotations}
        onFeedbackCreate={async (feedback, context) => {
          window.__threadmarkFeedback.push(feedback);
          setAnnotations((current) => [...current.filter((item) => item.feedback.id !== feedback.id), { feedback, context }]);
        }}
        onFeedbackDelete={async (feedback) => {
          setAnnotations((current) => current.filter((item) => item.feedback.id !== feedback.id));
        }}
      />
    </>
  );
}

createRoot(document.querySelector("#root")).render(<Fixture />);
