// <ThreadmarkSurveys>: the production-safe survey player. Mount it once near the app root with the
// host's live surveys; it shows at most one short question on a matching page, in its own shadow
// root, and hands each answer to `onAnswer`. It never imports the review overlay.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SurveyCard } from "./SurveyCard.jsx";
import { normalizeSurveys, surveyIsLive, surveyPageMatches } from "./schema.js";
import { surveyPlayerStyles } from "./styles.js";
import { resolveStableTarget } from "../resolveStableTarget.js";

const DONE_KEY = "threadmark:surveys:done";
const PENDING_KEY = "threadmark:surveys:pending";
const DISMISSED_KEY = "threadmark:surveys:dismissed";
const THANKS_MS = 3500;
const RETRY_DELAYS = [2000, 8000, 30000];

function readList(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeList(storage, key, list) {
  try {
    storage.setItem(key, JSON.stringify(list.slice(-200)));
  } catch {
    // Private windows and blocked storage: the survey may ask again on the next visit.
  }
}

const local = () => (typeof window === "undefined" ? null : window.localStorage);
const session = () => (typeof window === "undefined" ? null : window.sessionStorage);

/** Survey ids this person has answered or skipped, so a "once" survey isn't asked again. */
export function surveysDone() {
  const store = local();
  return store ? readList(store, DONE_KEY).filter((id) => typeof id === "string") : [];
}

function markDone(surveyId) {
  const store = local();
  if (store) writeList(store, DONE_KEY, [...new Set([...readList(store, DONE_KEY), surveyId])]);
}

function markDismissed(surveyId) {
  const store = session();
  if (store) writeList(store, DISMISSED_KEY, [...new Set([...readList(store, DISMISSED_KEY), surveyId])]);
}

function usePathname(route) {
  const [path, setPath] = useState(() => route || (typeof window === "undefined" ? "/" : window.location.pathname));
  useEffect(() => {
    if (route) {
      setPath(route);
      return undefined;
    }
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    // Client-side routers change the URL without popstate; a light check keeps the page current.
    const timer = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener("popstate", update);
      window.clearInterval(timer);
    };
  }, [route]);
  return path;
}

// A survey's target is a stable Threadmark id, or a CSS selector for elements without one.
function findTarget(target) {
  const found = resolveStableTarget(target).element;
  if (found) return found;
  try {
    return document.querySelector(target);
  } catch {
    return null;
  }
}

/** Picks the first survey this person should see on this page now. Exported for tests. */
export function pickSurvey(surveys, { path, viewer = "visitor", done = [], dismissed = [], answerCounts = {}, now = Date.now() }) {
  return surveys.find((survey) => {
    if (!surveyIsLive(survey, { now, answers: answerCounts[survey.id] || 0 })) return false;
    if (!survey.pages.some((page) => surveyPageMatches(page, path))) return false;
    if (survey.audience !== "everyone" && survey.audience !== (viewer === "team" ? "team" : "visitors")) return false;
    if (dismissed.includes(survey.id)) return false;
    if (survey.frequency === "once" && done.includes(survey.id)) return false;
    return true;
  }) || null;
}

export function ThreadmarkSurveys({
  surveys,
  route,
  viewer = "visitor",
  answerCounts,
  onAnswer,
  onShow,
  onDismiss,
  onError,
  styleNonce,
  disabled = false,
}) {
  const path = usePathname(route);
  const [root, setRoot] = useState(null);
  const [active, setActive] = useState(null);
  const [step, setStep] = useState("question");
  const [value, setValue] = useState(null);
  const [followUpText, setFollowUpText] = useState("");
  const [sending, setSending] = useState(false);
  const latest = useRef({});
  latest.current = { onAnswer, onShow, onDismiss, onError };

  const normalized = useMemo(
    () => normalizeSurveys(surveys, (item, error) => latest.current.onError?.({ code: "invalid_survey", surveyId: item?.id ?? null, message: error.message })),
    [surveys],
  );

  // Mount in a shadow root so host CSS can't reach the card.
  useEffect(() => {
    if (disabled || typeof document === "undefined") return undefined;
    const host = document.createElement("div");
    host.setAttribute("data-threadmark-surveys", "");
    const shadow = host.attachShadow({ mode: "open" });
    let adopted = false;
    try {
      if ("adoptedStyleSheets" in shadow && typeof CSSStyleSheet.prototype.replaceSync === "function") {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(surveyPlayerStyles);
        shadow.adoptedStyleSheets = [sheet];
        adopted = true;
      }
    } catch {
      adopted = false;
    }
    if (!adopted) {
      const style = document.createElement("style");
      if (styleNonce) style.nonce = styleNonce;
      style.textContent = surveyPlayerStyles;
      shadow.append(style);
    }
    const mount = document.createElement("div");
    shadow.append(mount);
    document.body.append(host);
    setRoot(mount);
    return () => {
      host.remove();
      setRoot(null);
    };
  }, [disabled, styleNonce]);

  // Answers that didn't send are kept and retried quietly (board 03, 13d).
  const deliver = useCallback(async (answer, attempt = 0) => {
    try {
      await latest.current.onAnswer?.(answer);
      const store = local();
      if (store) writeList(store, PENDING_KEY, readList(store, PENDING_KEY).filter((item) => item.key !== answer.key));
    } catch (error) {
      const store = local();
      if (store && !readList(store, PENDING_KEY).some((item) => item.key === answer.key)) writeList(store, PENDING_KEY, [...readList(store, PENDING_KEY), answer]);
      if (attempt < RETRY_DELAYS.length) {
        window.setTimeout(() => deliver(answer, attempt + 1), RETRY_DELAYS[attempt]);
      } else {
        latest.current.onError?.({ code: "answer_not_sent", surveyId: answer.surveyId, message: error?.message || "The answer could not be sent." });
      }
    }
  }, []);

  useEffect(() => {
    if (disabled) return;
    const store = local();
    if (!store) return;
    for (const answer of readList(store, PENDING_KEY)) deliver(answer, 1);
  }, [disabled, deliver]);

  // Choose what to show on this page, after the survey's delay.
  useEffect(() => {
    if (disabled || !root) return undefined;
    if (active && step !== "question") return undefined;
    const next = pickSurvey(normalized, {
      path,
      viewer,
      done: surveysDone(),
      dismissed: session() ? readList(session(), DISMISSED_KEY) : [],
      answerCounts: answerCounts || {},
    });
    if (!next) {
      if (active && step === "question") setActive(null);
      return undefined;
    }
    if (active?.id === next.id) return undefined;
    const timer = window.setTimeout(() => {
      setActive(next);
      setStep("question");
      setValue(null);
      setFollowUpText("");
      latest.current.onShow?.(next.id);
    }, next.delayMs);
    return () => window.clearTimeout(timer);
  }, [disabled, root, normalized, path, viewer, answerCounts, active, step]);

  // Thanks closes on its own after a few seconds.
  useEffect(() => {
    if (step !== "thanks" && step !== "closed") return undefined;
    const timer = window.setTimeout(() => setActive(null), THANKS_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  const finish = async () => {
    if (!active) return;
    setSending(true);
    const stillLive = surveyIsLive(active, { answers: (answerCounts || {})[active.id] || 0 });
    const answer = {
      key: `${active.id}:${Date.now().toString(36)}`,
      surveyId: active.id,
      value: value ?? (active.question.kind === "scale" && active.question.scale.display === "slider" ? Math.ceil(active.question.scale.points / 2) : null),
      followUp: followUpText.trim() || null,
      page: path,
      answeredAt: new Date().toISOString(),
    };
    markDone(active.id);
    deliver(answer);
    setSending(false);
    // A survey that closed while someone was answering still counts their answer (board 03, 13c).
    setStep(stillLive ? "thanks" : "closed");
  };

  const next = () => {
    if (step === "question" && active.followUp) setStep("followUp");
    else finish();
  };

  const skip = () => {
    if (step === "followUp") {
      finish();
      return;
    }
    markDone(active.id);
    latest.current.onDismiss?.(active.id, "skipped");
    setActive(null);
  };

  const close = () => {
    if (step === "question" || step === "followUp") {
      markDismissed(active.id);
      latest.current.onDismiss?.(active.id, "closed");
    }
    setActive(null);
  };

  if (!root || !active) return null;

  const element = active.placement.kind !== "page" && active.placement.target ? findTarget(active.placement.target) : null;
  const rect = element?.getBoundingClientRect?.();
  const position = rect && rect.width ? "element" : active.placement.position;
  const style = position === "element"
    ? { left: Math.max(12, Math.min(window.innerWidth - 352, rect.left)), top: Math.min(window.innerHeight - 220, rect.bottom + 8) }
    : undefined;

  return createPortal(
    <div className={`tms-layer tms-layer--${position}`} style={style}>
      <SurveyCard
        className="tms-enter"
        survey={active}
        step={step}
        value={value}
        followUpText={followUpText}
        onChange={setValue}
        onFollowUpChange={setFollowUpText}
        onNext={next}
        onSkip={skip}
        onClose={close}
        sending={sending}
      />
    </div>,
    root,
  );
}
