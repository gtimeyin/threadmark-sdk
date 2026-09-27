import { useEffect, useRef, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Database,
  ExternalLink,
  FileImage,
  Globe2,
  Group,
  Keyboard,
  Link2,
  LockKeyhole,
  MessageCircleReply,
  MousePointer2,
  MousePointerClick,
  Package,
  Pencil,
  Play,
  RefreshCw,
  ScanLine,
  ScanText,
  Server,
  ShieldCheck,
  Sparkles,
  SquareDashed,
  Trash2,
  UserRoundCheck,
  Workflow,
  Zap,
} from "lucide-react";
import "./project-page.css";
import { Wordmark } from "./BrandMark.jsx";

const INSTALL_COMMAND = "npm install threadmark-react@beta";

const CAPABILITIES = [
  { icon: MousePointer2, title: "Element selection", copy: "Attach feedback to the exact component, control, or visual surface." },
  { icon: Group, title: "Multi-element groups", copy: "Collect related interface elements into one ordered annotation." },
  { icon: ScanText, title: "Exact text selection", copy: "Review copy against the precise text range instead of a loose screenshot." },
  { icon: SquareDashed, title: "Region capture", copy: "Draw across empty space or a layout area when no single element is enough." },
  { icon: Pencil, title: "Screenshot markup", copy: "Select only the useful crop, draw in place, and attach the final marked image." },
  { icon: MousePointerClick, title: "Interaction recording", copy: "Capture a short, structured trace without recording the screen or typed values." },
];

const USE_CASES = [
  { label: "Product quality", items: ["Design QA", "Copy and content review", "Accessibility review"] },
  { label: "Release review", items: ["Vercel previews", "Internal acceptance testing", "Bug reporting"] },
  { label: "Collaboration", items: ["Stakeholder reviews", "Client feedback", "Developer handoff"] },
];

const STEPS = [
  ["Install", "Add threadmark-react to the application you want to review."],
  ["Mount", "Render one <Threadmark /> component near the application root."],
  ["Identify", "Pass the signed-in reviewer from your existing authentication system."],
  ["Review", "Select an element, text range, group, region, screenshot crop, or interaction."],
  ["Describe", "Add one clear comment in the anchored universal composer."],
  ["Receive", "Threadmark sends a structured feedback payload through your callback."],
  ["Restore", "Store the record and hydrate it back for continued discussion."],
];

const INTEGRATION_CODE = `import { Threadmark } from "threadmark-react";

export function AppReview({ user, deploymentId, annotations, saveFeedback }) {
  return (
    <Threadmark
      projectKey="marketing-site"
      reviewer={{ id: user.id, displayName: user.name }}
      enabled={import.meta.env.DEV || import.meta.env.MODE === "preview"}
      allowedHosts={["*.vercel.app"]}
      buildId={deploymentId}
      annotations={annotations}
      onFeedbackCreate={saveFeedback}
    />
  );
}`;

function SectionHeading({ eyebrow, title, copy, light = false }) {
  return (
    <div className={`project-section-heading ${light ? "is-light" : ""}`}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  );
}

export function ProjectPage() {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Threadmark — Review live interfaces in context";
    document.body.classList.add("project-page-active");
    return () => {
      document.title = previousTitle;
      document.body.classList.remove("project-page-active");
      window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyInstall = async () => {
    await navigator.clipboard?.writeText(INSTALL_COMMAND);
    setCopied(true);
    window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="project-page">
      <header className="project-nav">
        <a className="project-wordmark" href="/about" aria-label="Threadmark project page"><Wordmark size={28} /></a>
        <nav aria-label="Project navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#how-it-works">How it works</a>
          <a href="#integration">Integration</a>
          <a href="#roadmap">Roadmap</a>
        </nav>
        <a className="project-nav__github" href="https://github.com/gtimeyin/threadmark-sdk" target="_blank" rel="noreferrer">
          <Code2 size={17} /> GitHub
        </a>
      </header>

      <main>
        <section className="project-hero">
          <div className="project-hero__copy">
            <div className="project-kicker"><span /> Open-source beta · MIT</div>
            <h1>Review live interfaces without leaving the product.</h1>
            <p>Threadmark is an open-source React overlay for contextual comments, screenshot markup, and privacy-safe interaction traces.</p>
            <div className="project-hero__actions">
              <a className="project-button project-button--primary" href="/">
                <Play size={17} fill="currentColor" /> Try the demo
              </a>
              <button className="project-button project-button--install" onClick={copyInstall}>
                {copied ? <Check size={17} /> : <Clipboard size={17} />}
                {copied ? "Copied" : "Install package"}
              </button>
              <a className="project-text-link" href="https://github.com/gtimeyin/threadmark-sdk" target="_blank" rel="noreferrer">
                View GitHub <ArrowRight size={16} />
              </a>
            </div>
            <div className="project-install-line">
              <code>{INSTALL_COMMAND}</code>
              <span>v0.1.0-beta.4</span>
            </div>
          </div>

          <div className="project-demo-card" aria-label="Threadmark product preview">
            <div className="project-demo-card__bar"><i /><i /><i /><span>localhost:4175 / review</span></div>
            <div className="project-demo-card__body" aria-hidden="true">
              <div className="project-demo-copy">
                <span>Product release</span>
                <h2>Turn every launch into a shared learning loop.</h2>
                <p>Review the experience where it actually lives.</p>
                <button>Approve release · 0</button>
                <span className="project-target-box" aria-hidden="true"><b>1</b></span>
              </div>
              <aside className="project-demo-thread">
                <div className="project-demo-thread__title"><span>1</span><strong>Heading</strong></div>
                <div className="project-demo-author"><i>ER</i><span><strong>Emily R.</strong><small>Just now</small></span></div>
                <p>Make the outcome clearer before we ship this.</p>
                <div className="project-demo-trace"><MousePointer2 size={15} /><span><strong>2 recorded steps</strong><small>Privacy-safe interaction trace</small></span></div>
                <div className="project-demo-reply"><Sparkles size={15} /><span>Reply to thread…</span></div>
              </aside>
            </div>
          </div>
        </section>

        <section className="project-problem project-section" id="problem">
          <SectionHeading
            eyebrow="The problem"
            title="Feedback loses meaning when it leaves the interface."
            copy="Threadmark keeps the conversation attached to the page, build, target, and interaction that caused it."
          />
          <div className="project-problem__grid">
            {[
              ["01", "Screenshots lose the element, page, and behavior that made the issue visible."],
              ["02", "Teams bounce between design tools, chat, issue trackers, and the product itself."],
              ["03", "Developers receive vague requests without stable targets or reproduction steps."],
              ["04", "Reviewers spend more time explaining where a problem is than what should change."],
            ].map(([number, copy]) => (
              <article key={number}><span>{number}</span><p>{copy}</p></article>
            ))}
          </div>
        </section>

        <section className="project-capabilities project-section" id="capabilities">
          <SectionHeading
            eyebrow="What Threadmark does"
            title="One review surface. Six ways to preserve context."
            copy="Threadmark resolves the reviewer’s gesture automatically and opens the same compact comment flow every time."
          />
          <div className="project-capability-grid">
            {CAPABILITIES.map(({ icon: Icon, title, copy }, index) => (
              <article key={title}>
                <div className="project-capability-icon"><Icon size={20} strokeWidth={1.8} /></div>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <div className="project-discussion-strip">
            <div><MessageCircleReply size={20} /><span><strong>Discuss in place</strong>Reply to a previous comment without overwriting it.</span></div>
            <div><RefreshCw size={20} /><span><strong>Return with context</strong>Reopen annotations after navigation or reload.</span></div>
            <div><Trash2 size={20} /><span><strong>Delete deliberately</strong>See the impact before confirming a destructive action.</span></div>
          </div>
        </section>

        <section className="project-use-cases project-section">
          <SectionHeading eyebrow="Primary use cases" title="A review layer for every stage before release." />
          <div className="project-use-case-grid">
            {USE_CASES.map(({ label, items }, index) => (
              <article key={label}>
                <span>0{index + 1}</span>
                <h3>{label}</h3>
                <ul>{items.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="project-how project-section" id="how-it-works">
          <div className="project-how__intro">
            <SectionHeading
              eyebrow="How it works"
              title="A small integration with a clear ownership boundary."
              copy="Threadmark handles capture and review. Your application decides who can review, where feedback lives, and what happens next."
            />
            <div className="project-how__note"><Workflow size={21} /><p><strong>Backend-agnostic by design.</strong> Start with local storage, connect your own API, or add an adapter later without changing the annotation experience.</p></div>
          </div>
          <ol className="project-step-list">
            {STEPS.map(([title, copy], index) => (
              <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{copy}</p></div></li>
            ))}
          </ol>
        </section>

        <section className="project-integration project-section" id="integration">
          <SectionHeading
            eyebrow="React integration"
            title="Install once. Keep your existing stack."
            copy="Threadmark is a controlled component boundary, not a new authentication system or project-management backend."
          />
          <div className="project-integration__grid">
            <div className="project-code-card">
              <div className="project-code-card__bar"><span><i /><i /><i />AppReview.jsx</span><Code2 size={16} /></div>
              <pre><code>{INTEGRATION_CODE}</code></pre>
            </div>
            <div className="project-data-card">
              <span className="project-data-card__eyebrow">Structured feedback</span>
              <h3>Enough context to act without collecting everything.</h3>
              <ul>
                {[
                  [UserRoundCheck, "Reviewer identity and timestamps"],
                  [Globe2, "Canonical route and build ID"],
                  [ScanLine, "Element locators, bounds, and accessible name"],
                  [ScanText, "Exact selected text when relevant"],
                  [FileImage, "Approved screenshot metadata and Blob sidecar"],
                  [MousePointerClick, "Versioned privacy-safe interaction events"],
                  [MessageCircleReply, "Original comment and threaded replies"],
                ].map(([Icon, label]) => <li key={label}><Icon size={17} /><span>{label}</span></li>)}
              </ul>
              <a href="https://github.com/gtimeyin/threadmark-sdk/tree/main/packages/react" target="_blank" rel="noreferrer">Read the package documentation <ExternalLink size={15} /></a>
            </div>
          </div>
        </section>

        <section className="project-boundary project-section">
          <SectionHeading
            eyebrow="Storage and responsibility"
            title="Threadmark stays focused. Your application stays in control."
          />
          <div className="project-boundary-table" role="table" aria-label="Threadmark and host application responsibilities">
            <div className="project-boundary-table__head" role="row">
              <span role="columnheader"><Sparkles size={18} /> Threadmark provides</span>
              <span role="columnheader"><Server size={18} /> Host application provides</span>
            </div>
            {[
              ["Annotation and discussion interface", "Authentication"],
              ["Gesture resolution and anchoring", "Reviewer permissions"],
              ["Feedback payload schema", "Persistent storage"],
              ["Screenshot capture and metadata", "Screenshot Blob storage"],
              ["Interaction trace capture", "Notifications and real-time delivery"],
              ["Restoration and deep-link APIs", "Teams, projects, and dashboards"],
              ["Integration callbacks", "Backend access controls"],
            ].map(([left, right]) => <div className="project-boundary-table__row" role="row" key={left}><span role="cell">{left}</span><span role="cell">{right}</span></div>)}
          </div>
          <div className="project-storage-options">
            <div><Database size={20} /><span><strong>Local or custom storage</strong>Available through the callback and hydration API today.</span></div>
            <div><Package size={20} /><span><strong>Optional adapters</strong>Supabase and additional official adapters are planned.</span></div>
          </div>
        </section>

        <section className="project-privacy project-section">
          <div className="project-privacy__intro">
            <span className="project-privacy__seal"><ShieldCheck size={30} /></span>
            <SectionHeading
              eyebrow="Privacy and safety"
              title="Capture the useful context—not the secrets around it."
              copy="Privacy boundaries run locally before feedback reaches your callback. Threadmark does not upload evidence on its own."
              light
            />
          </div>
          <div className="project-privacy__grid">
            {[
              [LockKeyhole, "Sensitive controls", "Inputs, editable fields, and configured sensitive regions are excluded automatically."],
              [MousePointerClick, "Safe interaction traces", "Typed values, printable keystrokes, query strings, and URL fragments are never recorded."],
              [FileImage, "Selected crops only", "Screenshot markup begins with an explicit area selection and produces only that final crop."],
              [Globe2, "Fail-closed activation", "Local, preview, and allowed-host controls prevent accidental production activation."],
            ].map(([Icon, title, copy]) => <article key={title}><Icon size={22} /><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
          <div className="project-accessibility"><Accessibility size={20} /><span><strong>Built for different ways of working.</strong> Visible focus, keyboard controls, and reduced-motion behavior are part of the review surface.</span><Keyboard size={20} /></div>
        </section>

        <section className="project-vercel project-section">
          <div className="project-vercel__visual">
            <span className="project-vercel__logo">▲</span>
            <div className="project-vercel__route"><span>preview-8f42.vercel.app</span><CheckCircle2 size={16} /></div>
            <div className="project-vercel__commit"><span>Build</span><code>8f42c6d</code></div>
            <div className="project-vercel__review"><UserRoundCheck size={18} /><span><strong>Emily R.</strong> reviewing this deployment</span></div>
          </div>
          <div>
            <SectionHeading
              eyebrow="Vercel previews"
              title="Review the exact build before it becomes production."
              copy="Enable Threadmark on preview deployments, identify the signed-in reviewer, and associate every payload with the current commit."
            />
            <ol className="project-vercel__steps">
              <li><span>1</span>Allow the preview hostname.</li>
              <li><span>2</span>Pass the Vercel commit as the build ID.</li>
              <li><span>3</span>Save feedback through your chosen backend.</li>
              <li><span>4</span>Keep production disabled when review is not intended.</li>
            </ol>
          </div>
        </section>

        <section className="project-roadmap project-section" id="roadmap">
          <SectionHeading
            eyebrow="Current capabilities and roadmap"
            title="Useful today, intentionally unfinished."
            copy="The beta focuses on a dependable annotation SDK. Collaboration services remain separate and will grow around that stable boundary."
          />
          <div className="project-roadmap__grid">
            <article className="is-now">
              <div><span>Available now</span><i /></div>
              <ul>{[
                "Six capture contexts, including interaction recording",
                "Universal comments, replies, editing, and deletion",
                "Reviewer attribution and deep links",
                "Annotation hydration and element restoration",
                "Custom storage callbacks",
                "Privacy boundaries and allowed-host controls",
              ].map((item) => <li key={item}><CheckCircle2 size={16} />{item}</li>)}</ul>
            </article>
            <article>
              <div><span>Planned</span><i /></div>
              <ul>{[
                [RefreshCw, "Open, in-progress, and resolved lifecycle"],
                [Bell, "Mentions and notifications"],
                [FileImage, "File attachments beyond screenshots"],
                [Database, "Official storage adapters"],
                [Workflow, "Jira and Linear issue-tracker integrations"],
                [Workflow, "Real-time collaboration and permissions"],
                [Link2, "Advanced anchor-repair interface"],
              ].map(([Icon, item]) => <li key={item}><Icon size={16} />{item}</li>)}</ul>
            </article>
          </div>
          <div className="project-connector-preview">
            <div className="project-connector-preview__copy">
              <span>Near-term connector path</span>
              <h3>Turn an annotation into a linked Jira or Linear issue.</h3>
              <p>The connector would live outside the capture SDK. A reviewer chooses a destination, reviews the issue draft, and explicitly sends the structured Threadmark packet.</p>
            </div>
            <div className="project-connector-flow" aria-label="Threadmark issue tracker connector flow">
              <div><Sparkles size={18} /><span><strong>Threadmark</strong><small>Annotation packet</small></span></div>
              <ArrowRight size={17} aria-hidden="true" />
              <div className="project-connector-destinations"><span>Linear</span><span>Jira</span></div>
              <ArrowRight size={17} aria-hidden="true" />
              <div><CheckCircle2 size={18} /><span><strong>Linked issue</strong><small>Key and status synced</small></span></div>
            </div>
            <ul>
              <li><Check size={14} />Comment and discussion summary</li>
              <li><Check size={14} />Route, build, and deep link</li>
              <li><Check size={14} />Target and approved evidence</li>
              <li><Check size={14} />Project, assignee, and priority mapping</li>
            </ul>
          </div>
        </section>

        <section className="project-open-source project-section">
          <div>
            <SectionHeading
              eyebrow="Open source"
              title="A small package with an open direction."
              copy="Threadmark is MIT licensed and being shaped in public. Inspect the code, report an issue, or help improve the review experience."
            />
            <div className="project-open-source__actions">
              <a className="project-button project-button--primary" href="https://github.com/gtimeyin/threadmark-sdk" target="_blank" rel="noreferrer"><Code2 size={17} />View repository</a>
              <a className="project-button project-button--install" href="https://github.com/gtimeyin/threadmark-sdk/issues" target="_blank" rel="noreferrer">Report an issue <ExternalLink size={15} /></a>
            </div>
          </div>
          <div className="project-package-card">
            <div><Package size={25} /><span><strong>threadmark-react</strong><small>Open-source beta</small></span></div>
            <dl><div><dt>Version</dt><dd>0.1.0-beta.4</dd></div><div><dt>Licence</dt><dd>MIT</dd></div><div><dt>Framework</dt><dd>React</dd></div><div><dt>Browsers</dt><dd>Chrome · Edge</dd></div></dl>
          </div>
        </section>

        <section className="project-final-cta project-section">
          <span><Zap size={18} /> Start with the working beta</span>
          <h2>Put feedback where the work is.</h2>
          <p>Install Threadmark, open the demo, and review a live interface without rebuilding your application around a new platform.</p>
          <div>
            <button className="project-button project-button--primary" onClick={copyInstall}>{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? "Copied" : "Copy install command"}</button>
            <a className="project-button project-button--install" href="/">Try the working demo <ArrowRight size={16} /></a>
          </div>
        </section>
      </main>

      <footer className="project-footer">
        <a className="project-wordmark" href="/about" aria-label="Threadmark"><Wordmark size={28} /></a>
        <span>Contextual product feedback for React applications.</span>
        <div><a href="https://github.com/gtimeyin/threadmark-sdk" target="_blank" rel="noreferrer">GitHub</a><a href="https://github.com/gtimeyin/threadmark-sdk/tree/main/packages/react" target="_blank" rel="noreferrer">Documentation</a><a href="/">Demo</a></div>
      </footer>
    </div>
  );
}
