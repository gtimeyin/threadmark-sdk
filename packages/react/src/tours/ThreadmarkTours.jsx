import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { resolveStableTarget } from "../resolveStableTarget.js";
import { DEFAULT_TOUR_RULES, pathMatches, pickTour } from "./eligibility.js";
import { PHONE_MAX_WIDTH, placeCard, scrollForSheet } from "./placement.js";
import {
  TERMINAL_STATUSES,
  createLocalProgressStore,
  createProgressRecord,
  mergeProgressRecords,
  normalizeProgressRecord,
  resumeStepIndex,
} from "./progress.js";
import { parseDuration, validateTour } from "./schema.js";
import { tourStyles } from "./styles.js";
import { themeToCssVariables } from "./theme.js";

const VISIT_KEY = "threadmark:tours:visit";
const SLOW_NOTICE_MS = 400;
const SPOT_PADDING = 6;

// One player per page. useThreadmarkTours() talks to whichever instance is mounted.
let activeInstance = null;

function readVisit() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(VISIT_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberVisit(tourId) {
  try {
    const shown = readVisit();
    if (!shown.includes(tourId)) window.sessionStorage.setItem(VISIT_KEY, JSON.stringify([...shown, tourId]));
  } catch {
    // Session storage is optional; without it every page load counts as a new visit.
  }
}

function isUsableTarget(element) {
  if (!element.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
  if (!element.getClientRects().length) return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
}

function describeTarget(element) {
  return (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
}

function rectOf(element) {
  const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
  return { left, top, right, bottom, width, height };
}

const sameRect = (a, b) => Boolean(a && b) && ["left", "top", "width", "height"].every((key) => Math.abs(a[key] - b[key]) < 0.5);
const samePlacement = (a, b) => Boolean(a && b) && ["mode", "side", "left", "top", "arrowOffset"].every((key) => a[key] === b[key]);
const isPhoneViewport = () => window.innerWidth <= PHONE_MAX_WIDTH;
const motion = () => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const isLocalDevelopment = () => typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(window.location.hostname);

/** Steps without their own page continue on the previous step's page; the first uses showTo.path when it's exact. */
function stepPages(tour) {
  let page = tour.showTo.path && !tour.showTo.path.endsWith("*") ? tour.showTo.path : undefined;
  return tour.steps.map((step) => (page = step.page ?? page));
}

function effectiveStep(step, phone) {
  if (!phone || !step.phone) return step;
  return { ...step, ...Object.fromEntries(Object.entries(step.phone).filter(([, value]) => value !== undefined)) };
}

function normalizeRules(rules) {
  const gapMs = rules?.gap === undefined ? DEFAULT_TOUR_RULES.gapMs : parseDuration(rules.gap);
  const perVisit = Number.isInteger(rules?.perVisit) && rules.perVisit >= 0 ? rules.perVisit : DEFAULT_TOUR_RULES.perVisit;
  return { perVisit, gapMs: gapMs ?? DEFAULT_TOUR_RULES.gapMs };
}

/**
 * Plays product tours in production. Tours are validated data; steps point at elements tagged with
 * threadmarkTarget(). Nothing is captured or sent anywhere: progress stays in this browser unless
 * `onProgressChange` is supplied, and events go only to `onTourEvent`.
 */
export function ThreadmarkTours({
  tours = [],
  user,
  navigate,
  progress,
  onProgressChange,
  onTourEvent,
  onTourNote,
  onError,
  theme,
  rules,
  path: pathProp,
  styleNonce,
  children,
}) {
  const [mount, setMount] = useState(null);
  const [path, setPath] = useState(pathProp ?? null);
  const [phone, setPhone] = useState(false);
  const [viewportTick, setViewportTick] = useState(0);
  const [records, setRecords] = useState({});
  const [recordsReady, setRecordsReady] = useState(false);
  const [run, setRun] = useState(null);
  const [target, setTarget] = useState({ status: "idle" });
  const [resolveTick, setResolveTick] = useState(0);
  const [rect, setRect] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [note, setNote] = useState({ open: false, text: "", state: "idle" });
  const [announcement, setAnnouncement] = useState("");

  const ids = { title: useId(), body: useId() };
  const cardRef = useRef(null);
  const titleRef = useRef(null);
  const returnFocusRef = useRef(null);
  const keyRef = useRef(0);
  const handledRef = useRef({ shown: null, focused: null, scrolled: null });
  const latest = useRef(null);

  const controlled = typeof onProgressChange === "function";
  const userId = user?.id === undefined || user?.id === null ? undefined : String(user.id);
  const userKey = JSON.stringify(user ?? null);
  const store = useMemo(() => createLocalProgressStore(typeof window === "undefined" ? undefined : window.localStorage), []);
  const tourRules = useMemo(() => normalizeRules(rules), [rules?.perVisit, rules?.gap]);

  // Tours are usually written inline, so key them by content rather than array identity.
  const toursKey = JSON.stringify(tours);
  const validated = useMemo(() => (Array.isArray(tours) ? tours : []).map((input) => ({ input, result: validateTour(input) })), [toursKey]);
  const playable = useMemo(() => {
    const seen = new Set();
    return validated.filter(({ result }) => result.ok && !seen.has(result.tour.id) && seen.add(result.tour.id)).map(({ result }) => result.tour);
  }, [validated]);
  const byId = useMemo(() => new Map(playable.map((tour) => [tour.id, tour])), [playable]);

  const tour = run ? byId.get(run.tourId) : null;
  const pages = useMemo(() => (tour ? stepPages(tour) : []), [tour]);
  const step = tour ? effectiveStep(tour.steps[run.index], phone) : null;
  const stepPage = tour ? pages[run.index] : undefined;
  const away = Boolean(run?.mode === "step" && stepPage && path && !pathMatches(stepPage, path));

  function report(error) {
    if (typeof latest.current?.onError === "function") {
      try {
        latest.current.onError(error);
      } catch {
        // A failing host callback must not break the tour.
      }
    } else if (isLocalDevelopment()) {
      console.warn(`[threadmark tours] ${error.message}`, error);
    }
  }

  function emit(type, extra = {}) {
    const handler = latest.current?.onTourEvent;
    if (typeof handler !== "function") return;
    try {
      handler({ type, tourId: latest.current.run?.tourId, at: Date.now(), ...extra });
    } catch {
      // Analytics callbacks are fire-and-forget.
    }
  }

  function saveRecord(record) {
    setRecords((current) => ({ ...current, [record.tourId]: record }));
    if (latest.current.controlled) {
      Promise.resolve()
        .then(() => latest.current.onProgressChange(record))
        .catch((error) => report({ code: "progress_save_failed", message: "Saving tour progress failed.", tourId: record.tourId, error }));
    } else {
      store.write(record);
    }
  }

  function updateRecord(tourId, patch) {
    const current = latest.current.records[tourId] || createProgressRecord(tourId, latest.current.userId, Date.now());
    const record = { ...current, ...patch, updatedAt: Date.now() };
    saveRecord(record);
    return record;
  }

  function begin(nextTour, { mode = "step", index = 0, fresh = false } = {}) {
    const focused = document.activeElement;
    returnFocusRef.current = focused && focused !== mount?.host && !mount?.host.contains(focused) ? focused : null;
    rememberVisit(nextTour.id);
    keyRef.current += 1;
    setRun({ tourId: nextTour.id, index, mode, key: keyRef.current });
    latest.current.run = { tourId: nextTour.id };
    if (mode !== "step") return;
    const existing = latest.current.records[nextTour.id];
    if (fresh || !existing || TERMINAL_STATUSES.has(existing.status)) {
      saveRecord(createProgressRecord(nextTour.id, latest.current.userId, Date.now()));
      emit("started", { tourId: nextTour.id });
    } else {
      updateRecord(nextTour.id, { status: "inProgress" });
      emit("resumed", { tourId: nextTour.id, stepIndex: index });
    }
  }

  function beginPicked(picked) {
    if (!picked.resume) return begin(picked.tour);
    const index = resumeStepIndex(picked.tour, picked.record);
    return begin(picked.tour, { mode: picked.continueDirectly ? "step" : "offer", index });
  }

  function finish(status) {
    const current = latest.current.run;
    if (!current) return;
    updateRecord(current.tourId, { status });
    emit(status, { stepId: latest.current.step?.id, stepIndex: current.index });
    setRun(null);
    latest.current.run = null;
    const returnTo = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnTo?.isConnected && typeof returnTo.focus === "function") returnTo.focus({ preventScroll: true });
  }

  function goTo(index) {
    const current = latest.current.run;
    const currentTour = current && byId.get(current.tourId);
    if (!currentTour) return;
    if (index >= currentTour.steps.length) return finish("finished");
    if (index < 0) return;
    if (index > current.index) emit("stepCompleted", { stepId: currentTour.steps[current.index].id, stepIndex: current.index });
    const nextPage = stepPages(currentTour)[index];
    const go = latest.current.navigate;
    if (nextPage && latest.current.path && !pathMatches(nextPage, latest.current.path)
      && currentTour.steps[index].arrive === "navigate" && typeof go === "function" && !nextPage.endsWith("*")) {
      go(nextPage);
    }
    keyRef.current += 1;
    setRun({ ...current, index, mode: "step", key: keyRef.current });
  }

  latest.current = {
    ...latest.current,
    onProgressChange,
    onTourEvent,
    onTourNote,
    onError,
    navigate,
    controlled,
    userId,
    user,
    records,
    run,
    step,
    path,
  };

  // Mount the player in its own shadow root so host CSS can't reach it.
  useEffect(() => {
    if (activeInstance) {
      report({ code: "duplicate_instance", message: "Only one <ThreadmarkTours> can be mounted on a page." });
      return undefined;
    }
    const host = document.createElement("div");
    host.setAttribute("data-threadmark-tours", "");
    const shadow = host.attachShadow({ mode: "open" });
    let adopted = false;
    try {
      if ("adoptedStyleSheets" in shadow && typeof CSSStyleSheet.prototype.replaceSync === "function") {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(tourStyles);
        shadow.adoptedStyleSheets = [sheet];
        adopted = true;
      }
    } catch {
      adopted = false;
    }
    if (!adopted) {
      const style = document.createElement("style");
      if (styleNonce) style.nonce = styleNonce;
      style.textContent = tourStyles;
      shadow.append(style);
    }
    const root = document.createElement("div");
    root.className = "tmt";
    shadow.append(root);
    document.body.append(host);
    const instance = {
      start: (tourId) => latest.current.api.start(tourId),
      emit: (event) => latest.current.api.emit(event),
      reset: (tourId) => latest.current.api.reset(tourId),
    };
    activeInstance = instance;
    setMount({ host, root });
    return () => {
      if (activeInstance === instance) activeInstance = null;
      host.remove();
    };
  }, []);

  latest.current.api = {
    start(tourId) {
      const requested = byId.get(tourId);
      if (!requested) {
        report({ code: "unknown_tour", message: `No playable tour with id "${tourId}".`, tourId });
        return false;
      }
      begin(requested, { fresh: true });
      return true;
    },
    emit(event) {
      if (latest.current.run || !recordsReady || !path) return false;
      const picked = pickTour(playable, { path, device: phone ? "phone" : "desktop", user: latest.current.user, now: Date.now() }, {
        records: latest.current.records,
        shownThisVisit: readVisit(),
        rules: tourRules,
        trigger: { kind: "event", event: String(event) },
      });
      if (!picked) return false;
      beginPicked(picked);
      return true;
    },
    reset(tourId) {
      store.remove(tourId, latest.current.userId);
      setRecords((current) => {
        const next = { ...current };
        delete next[tourId];
        return next;
      });
    },
  };

  useEffect(() => {
    validated.forEach(({ input, result }, index) => {
      if (!result.ok) {
        report({ code: "invalid_tour", message: `Tour ${input?.id ? `"${input.id}"` : `#${index + 1}`} is invalid and won't play.`, tourId: input?.id, errors: result.errors });
      }
    });
    const ids = playable.map((item) => item.id);
    validated.forEach(({ result }) => {
      if (result.ok && ids.indexOf(result.tour.id) !== ids.lastIndexOf(result.tour.id)) {
        report({ code: "duplicate_tour", message: `More than one tour uses the id "${result.tour.id}"; only the first plays.`, tourId: result.tour.id });
      }
    });
  }, [validated, playable]);

  useEffect(() => {
    if (!mount) return undefined;
    const variables = themeToCssVariables(theme);
    for (const [property, value] of Object.entries(variables)) mount.host.style.setProperty(property, value);
    return () => {
      for (const property of Object.keys(variables)) mount.host.style.removeProperty(property);
    };
  }, [mount, JSON.stringify(theme ?? null)]);

  // Follow the current path: from the `path` prop when the app provides it, otherwise from the URL.
  useEffect(() => {
    if (pathProp !== undefined) {
      setPath(pathProp);
      return undefined;
    }
    const sync = () => setPath(window.location.pathname);
    sync();
    window.addEventListener("popstate", sync);
    const timer = window.setInterval(sync, 250);
    return () => {
      window.removeEventListener("popstate", sync);
      window.clearInterval(timer);
    };
  }, [pathProp]);

  useEffect(() => {
    const sync = () => {
      setPhone(isPhoneViewport());
      setViewportTick((tick) => tick + 1);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Load progress: from the host when it owns storage, otherwise from this browser.
  useEffect(() => {
    if (controlled) {
      const incoming = (Array.isArray(progress) ? progress : [])
        .map(normalizeProgressRecord)
        .filter((record) => record && (!record.userId || !userId || record.userId === userId));
      setRecords((current) => {
        const next = { ...current };
        for (const record of incoming) next[record.tourId] = mergeProgressRecords(next[record.tourId], record);
        return next;
      });
    } else {
      setRecords(Object.fromEntries(playable.map((item) => [item.id, store.read(item.id, userId)]).filter(([, record]) => record)));
    }
    setRecordsReady(true);
  }, [controlled, progress, userId, playable]);

  // Start a tour on page load (after its optional wait), one at a time.
  useEffect(() => {
    if (run || !recordsReady || !path || !mount) return undefined;
    const context = { path, device: phone ? "phone" : "desktop", user: latest.current.user, now: Date.now() };
    const picked = pickTour(playable, context, { records, shownThisVisit: readVisit(), rules: tourRules, trigger: { kind: "pageLoad" } });
    if (!picked) return undefined;
    const timer = window.setTimeout(() => {
      if (latest.current.run || latest.current.path !== path) return;
      beginPicked(picked);
    }, picked.resume ? 0 : picked.tour.start.waitMs);
    return () => window.clearTimeout(timer);
  }, [run, recordsReady, path, phone, playable, records, tourRules, userKey, mount]);

  // Wait for the step's target to appear, then hold on to it. Never guess between several matches.
  useEffect(() => {
    if (!run || run.mode !== "step" || away || !step) {
      setTarget({ status: "idle" });
      return undefined;
    }
    if (!step.target || step.style === "modal") {
      setTarget({ status: "none", key: run.key });
      return undefined;
    }
    let settled = false;
    let frame = 0;
    const timers = [];
    let observer = null;
    const cleanup = () => {
      observer?.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      if (frame) window.cancelAnimationFrame(frame);
    };
    const attempt = () => {
      frame = 0;
      if (settled) return;
      const found = resolveStableTarget(step.target, { accept: isUsableTarget });
      if (found.status !== "resolved") return;
      settled = true;
      cleanup();
      setTarget({ status: "resolved", key: run.key, element: found.element, name: describeTarget(found.element) });
    };
    setTarget({ status: "waiting", key: run.key });
    attempt();
    if (!settled) {
      observer = new MutationObserver(() => {
        if (!frame) frame = window.requestAnimationFrame(attempt);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-threadmark-id", "hidden", "style", "class", "aria-hidden", "inert"] });
      timers.push(window.setTimeout(() => setTarget((current) => (current.status === "waiting" && current.key === run.key ? { status: "slow", key: run.key } : current)), SLOW_NOTICE_MS));
      timers.push(window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const found = resolveStableTarget(step.target, { accept: isUsableTarget });
        setTarget({ status: "missing", key: run.key });
        emit("targetMissing", { stepId: step.id, stepIndex: run.index, reason: found.status, target: step.target });
      }, step.waitMs));
    }
    return () => {
      settled = true;
      cleanup();
    };
  }, [run?.key, run?.mode, away, step?.target, step?.style, step?.waitMs, resolveTick]);

  // Track the target's position while the step is up.
  useEffect(() => {
    if (target.status !== "resolved") {
      setRect(null);
      return undefined;
    }
    const element = target.element;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!element.isConnected) {
        setResolveTick((tick) => tick + 1);
        return;
      }
      const next = rectOf(element);
      setRect((current) => (sameRect(current, next) ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const bounds = element.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight || bounds.left < 0 || bounds.right > window.innerWidth) {
      if (!isPhoneViewport()) element.scrollIntoView({ block: "center", inline: "nearest", behavior: motion() });
    }
    update();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(element);
    resizeObserver?.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [target]);

  // "click" steps move on when the person uses the real element.
  useEffect(() => {
    if (target.status !== "resolved" || step?.next !== "click") return undefined;
    const element = target.element;
    const onClick = () => window.setTimeout(() => goTo((latest.current.run?.index ?? 0) + 1), 0);
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [target, step?.next]);

  // Target state belongs to one step; ignore what's left over from the previous step until it updates.
  const targetStatus = run && target.key === run.key ? target.status : "idle";
  const showingStep = Boolean(run?.mode === "step" && !away && (targetStatus === "resolved" || targetStatus === "none"));
  const showingMissing = Boolean(run?.mode === "step" && !away && targetStatus === "missing");
  const showingOffer = run?.mode === "offer";
  const showingCard = showingStep || showingMissing || showingOffer;

  // Record the step as seen and announce it, once per step.
  useEffect(() => {
    if (!showingStep || handledRef.current.shown === run.key) return;
    handledRef.current.shown = run.key;
    const current = latest.current.records[run.tourId];
    updateRecord(run.tourId, { status: "inProgress", stepId: step.id, seen: [...new Set([...(current?.seen || []), step.id])] });
    emit("stepShown", { stepId: step.id, stepIndex: run.index });
    const name = targetStatus === "resolved" ? target.name : "";
    setAnnouncement(`Step ${run.index + 1} of ${tour.steps.length}. ${step.title}.${name ? ` Points to: ${name}.` : ""}`);
  }, [showingStep, run?.key]);

  useEffect(() => {
    setNote({ open: false, text: "", state: "idle" });
  }, [run?.key, run?.mode]);

  // Place the card once it has a size; move the page so a bottom sheet never covers the target.
  // Each new card is first rendered hidden at its natural size, then placed, all before paint.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!showingCard || !card) return;
    const cardFor = `${run.key}:${run.mode}:${targetStatus}`;
    if (handledRef.current.placedFor !== cardFor) {
      handledRef.current.placedFor = cardFor;
      if (placement) {
        setPlacement(null);
        return;
      }
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const anchor = showingStep && rect ? rect : null;
    const next = placeCard({ target: anchor, card: { width: card.offsetWidth, height: card.offsetHeight }, viewport, placement: showingStep ? step.placement : "auto" });
    if (!samePlacement(placement, next)) setPlacement(next);
    if (next.mode === "sheet" && anchor && handledRef.current.scrolled !== run.key) {
      handledRef.current.scrolled = run.key;
      const offset = scrollForSheet({ target: anchor, sheetHeight: card.offsetHeight, viewport });
      if (offset) window.scrollBy({ top: offset, behavior: motion() });
    }
  });

  // Focus lands on the title, so people hear what the step is about before what to press.
  useEffect(() => {
    if (!showingCard || !placement || handledRef.current.focused === `${run.key}:${run.mode}:${targetStatus}`) return;
    handledRef.current.focused = `${run.key}:${run.mode}:${targetStatus}`;
    titleRef.current?.focus({ preventScroll: true });
  }, [showingCard, placement, run?.key, run?.mode, targetStatus]);

  async function sendNote() {
    const text = note.text.trim();
    if (!text || typeof latest.current.onTourNote !== "function") return;
    setNote((current) => ({ ...current, state: "sending" }));
    try {
      await latest.current.onTourNote({ tourId: run.tourId, stepId: step.id, stepIndex: run.index, text: text.slice(0, 2000), path });
      setNote({ open: false, text: "", state: "sent" });
    } catch {
      setNote((current) => ({ ...current, state: "failed" }));
    }
  }

  function onCardKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      finish("paused");
      return;
    }
    const typing = event.target?.tagName === "TEXTAREA";
    if (!typing && showingStep && event.key === "ArrowRight" && step.next !== "click") {
      event.preventDefault();
      goTo(run.index + 1);
    } else if (!typing && showingStep && event.key === "ArrowLeft" && run.index > 0) {
      event.preventDefault();
      goTo(run.index - 1);
    } else if (event.key === "Tab" && showingStep && step.style === "modal") {
      const focusable = [...cardRef.current.querySelectorAll("button, textarea, [tabindex='0']")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = mount.root.getRootNode().activeElement;
      if (event.shiftKey && (active === first || active === titleRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  let ui = null;
  if (run && tour) {
    const total = tour.steps.length;
    const modal = showingStep && step.style === "modal";
    const mode = placement?.mode;
    const cardStyle = !placement ? { visibility: "hidden", left: 0, top: 0 } : mode === "anchored" ? { left: placement.left, top: placement.top } : undefined;
    let content = null;

    if (showingOffer) {
      const resumeAt = tour.steps[run.index];
      content = {
        title: "Pick up where you left off?",
        body: `Step ${run.index + 1} of ${total} · ${resumeAt.title}`,
        secondary: <button type="button" className="tmt-link" onClick={() => finish("skipped")}>No thanks</button>,
        actions: (
          <>
            <button type="button" className="tmt-btn" onClick={() => {
              saveRecord(createProgressRecord(run.tourId, userId, Date.now()));
              emit("started");
              keyRef.current += 1;
              setRun({ ...run, index: 0, mode: "step", key: keyRef.current });
            }}>Start over</button>
            <button type="button" className="tmt-btn" data-primary="" onClick={() => {
              updateRecord(run.tourId, { status: "inProgress" });
              emit("resumed", { stepIndex: run.index });
              keyRef.current += 1;
              setRun({ ...run, mode: "step", key: keyRef.current });
            }}>Continue</button>
          </>
        ),
      };
    } else if (showingMissing) {
      content = {
        title: "We couldn’t find this one",
        body: "This part of the page may have moved. You can skip ahead, or come back to the tour later.",
        secondary: <button type="button" className="tmt-link" onClick={() => finish("paused")}>Not now</button>,
        actions: <button type="button" className="tmt-btn" data-primary="" onClick={() => goTo(run.index + 1)}>{run.index + 1 >= total ? "Finish" : "Skip ahead"}</button>,
      };
    } else if (showingStep) {
      const isLast = run.index + 1 >= total;
      content = {
        count: total > 1 ? `Step ${run.index + 1} of ${total}` : null,
        title: step.title,
        body: step.body,
        hint: step.next === "click" && targetStatus === "resolved"
          ? `Use ${target.name ? `“${target.name}”` : "the highlighted element"} to continue.`
          : null,
        secondary: <button type="button" className="tmt-link" onClick={() => finish("paused")}>Not now</button>,
        actions: (
          <>
            {run.index > 0 ? <button type="button" className="tmt-btn" onClick={() => goTo(run.index - 1)}>Back</button> : null}
            {step.next === "click" ? null : (
              <button type="button" className="tmt-btn" data-primary="" onClick={() => goTo(run.index + 1)}>{isLast ? "Finish" : "Next"}</button>
            )}
          </>
        ),
      };
    }

    ui = (
      <>
        {showingStep && rect && !modal ? (
          <div
            className="tmt-spot"
            data-style={step.style}
            aria-hidden="true"
            style={{ left: rect.left - SPOT_PADDING, top: rect.top - SPOT_PADDING, width: rect.width + SPOT_PADDING * 2, height: rect.height + SPOT_PADDING * 2 }}
          />
        ) : null}
        {modal ? <div className="tmt-backdrop" aria-hidden="true" /> : null}

        {content ? (
          <section
            ref={cardRef}
            className="tmt-card"
            role="dialog"
            aria-modal={modal}
            aria-labelledby={ids.title}
            aria-describedby={content.body ? ids.body : undefined}
            data-mode={mode || "measure"}
            style={cardStyle}
            onKeyDown={onCardKeyDown}
          >
            {mode === "anchored" ? (
              <span
                className="tmt-arrow"
                data-side={placement.side}
                aria-hidden="true"
                style={placement.side === "top" || placement.side === "bottom" ? { left: placement.arrowOffset - 6 } : { top: placement.arrowOffset - 6 }}
              />
            ) : null}
            {content.count ? <div className="tmt-count">{content.count}</div> : null}
            <h2 ref={titleRef} id={ids.title} className="tmt-title" tabIndex={-1}>{content.title}</h2>
            {content.body ? <p id={ids.body} className="tmt-body">{content.body}</p> : null}
            {content.hint ? <p className="tmt-hint">{content.hint}</p> : null}
            <div className="tmt-row">
              {content.secondary}
              <div className="tmt-actions">{content.actions}</div>
            </div>
            {showingStep && typeof onTourNote === "function" ? (
              <div className="tmt-note">
                {note.open ? (
                  <>
                    <textarea
                      aria-label="What’s unclear about this step?"
                      placeholder="What’s unclear about this step?"
                      value={note.text}
                      maxLength={2000}
                      onChange={(event) => setNote({ ...note, text: event.target.value })}
                    />
                    {note.state === "failed" ? <p className="tmt-hint" role="alert">That didn’t send. Try again?</p> : null}
                    <div className="tmt-actions">
                      <button type="button" className="tmt-btn" onClick={() => setNote({ open: false, text: "", state: "idle" })}>Cancel</button>
                      <button type="button" className="tmt-btn" data-primary="" disabled={!note.text.trim() || note.state === "sending"} onClick={sendNote}>Send</button>
                    </div>
                  </>
                ) : note.state === "sent" ? (
                  <p className="tmt-hint" role="status">Thanks. The team will see this on this step.</p>
                ) : (
                  <button type="button" className="tmt-link" onClick={() => setNote({ open: true, text: "", state: "idle" })}>Something unclear here?</button>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {run.mode === "step" && away ? (
          <div className="tmt-bar" role="status">
            <span>{typeof navigate === "function" ? `Tour paused. The next step is on ${stepPage}.` : `Head to ${stepPage} to continue the tour.`}</span>
            {typeof navigate === "function" && !stepPage.endsWith("*") ? (
              <button type="button" className="tmt-btn" onClick={() => navigate(stepPage)}>Back to the tour</button>
            ) : null}
            <button type="button" className="tmt-btn" onClick={() => finish("paused")}>Not now</button>
          </div>
        ) : null}
        {run.mode === "step" && !away && targetStatus === "slow" ? (
          <div className="tmt-bar" role="status">
            <span className="tmt-spinner" aria-hidden="true" />
            <span>Getting the next step ready…</span>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {children}
      {mount
        ? createPortal(
          <>
            {ui}
            <div className="tmt-live" aria-live="polite">{announcement}</div>
          </>,
          mount.root,
        )
        : null}
    </>
  );
}

/** Start, trigger, or reset tours from anywhere in the app. Safe to call before the player mounts. */
export function useThreadmarkTours() {
  return useMemo(() => ({
    start: (tourId) => activeInstance?.start(tourId) ?? false,
    emit: (event) => activeInstance?.emit(event) ?? false,
    reset: (tourId) => activeInstance?.reset(tourId),
  }), []);
}
