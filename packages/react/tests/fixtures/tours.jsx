import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { ThreadmarkTours, threadmarkTarget, useThreadmarkTours } from "../../src/tours.js";

const params = new URLSearchParams(window.location.search);
window.__tourEvents = [];
window.__tourNotes = [];
window.__tourErrors = [];

const welcome = {
  id: "welcome",
  title: "Welcome",
  showTo: { path: "/projects" },
  steps: [
    { id: "new", target: "projects.new", title: "Start something new", body: "Every project begins here." },
    { id: "invite", target: "projects.invite", title: "Bring your people in", next: "click" },
    { id: "templates", target: params.has("missing") ? "projects.nowhere" : "projects.slow", title: "Templates live here", waitFor: { timeout: "2s" } },
    { id: "team", page: "/team", target: "team.list", title: "Your team lives here", phone: { title: "Your team, on the go" } },
  ],
};

const help = { id: "help", title: "Help", start: "manual", steps: [{ id: "intro", title: "How can we help?", style: "modal" }] };
const broken = { id: "broken", title: "Broken", steps: [{ id: "one", title: "No target here" }] };

function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const go = (to) => {
    window.history.pushState({}, "", `${to}${window.location.search}`);
    setPath(to);
  };
  return [path, go];
}

function HelpButton() {
  const tours = useThreadmarkTours();
  return <button type="button" onClick={() => tours.start("help")}>Help</button>;
}

function App() {
  const [path, go] = usePath();
  const [slow, setSlow] = useState(false);
  return (
    <ThreadmarkTours
      tours={params.has("invalid") ? [broken, welcome, help] : [welcome, help]}
      navigate={go}
      rules={{ gap: "0ms" }}
      onTourEvent={(event) => window.__tourEvents.push(event)}
      onTourNote={params.has("notes") ? async (note) => { window.__tourNotes.push(note); } : undefined}
      onError={(error) => window.__tourErrors.push({ code: error.code, tourId: error.tourId, paths: error.errors?.map((item) => item.path) })}
    >
      <nav>
        <button type="button" onClick={() => go("/projects")}>Projects</button>
        <button type="button" onClick={() => go("/team")}>Team</button>
        <HelpButton />
      </nav>
      {path === "/team" ? (
        <main>
          <h1>Team</h1>
          <ul {...threadmarkTarget("team.list")}><li>Ada</li><li>Sam</li></ul>
        </main>
      ) : (
        <main>
          <h1>Projects</h1>
          <label>Search <input id="search" /></label>
          <button type="button" {...threadmarkTarget("projects.new")}>New project</button>
          <button type="button" {...threadmarkTarget("projects.invite")} onClick={() => window.setTimeout(() => setSlow(true), 900)}>Invite</button>
          {slow ? <a href="#templates" {...threadmarkTarget("projects.slow")}>Templates</a> : null}
          <p id="below-the-fold">More projects</p>
        </main>
      )}
    </ThreadmarkTours>
  );
}

createRoot(document.getElementById("root")).render(<App />);
window.__toursMounted = true;
