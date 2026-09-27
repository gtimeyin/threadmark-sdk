import { useEffect, useState } from "react";
import {
  Aperture as SiLoom,
  ArrowRight,
  AtSign as At,
  Check,
  ChevronDown as CaretDown,
  ChevronUp as CaretUp,
  CircleCheck as CheckCircle,
  Copy,
  Ellipsis as DotsThree,
  History as ClockCounterClockwise,
  ListChecks as SiLinear,
  ListFilter,
  LockKeyhole,
  MessageSquareText as ChatCircleText,
  Moon,
  MousePointer2 as Cursor,
  NotebookText as SiNotion,
  Paperclip,
  PanelsTopLeft as SiWebflow,
  Rocket as RocketLaunch,
  Send as PaperPlaneTilt,
  Shapes as SiFigma,
  Share2 as ShareNetwork,
  Smartphone as DeviceMobile,
  Sparkles as Sparkle,
  Sun,
  Triangle as SiVercel,
  Type as TextT,
  Users as UsersThree,
  X,
} from "lucide-react";
import { ProjectPage } from "./ProjectPage.jsx";
import { Wordmark } from "./BrandMark.jsx";

const REVIEWERS = {
  emily: {
    id: "emily",
    name: "Emily Ross",
    shortName: "Emily",
    role: "Product Designer",
    email: "emily@northstar.dev",
    avatar: "emily",
  },
  sam: {
    id: "sam",
    name: "Sam Chen",
    shortName: "Sam",
    role: "Product Manager",
    email: "sam@northstar.dev",
    initials: "SC",
  },
  priya: {
    id: "priya",
    name: "Priya Nair",
    shortName: "Priya",
    role: "Frontend Lead",
    email: "priya@northstar.dev",
    initials: "PN",
  },
};

const CURRENT_USER_ID = "emily";

const TARGETS = {
  hero: {
    number: 1,
    label: "HeroHeading · HomePage",
    shortLabel: "Hero heading",
    category: "Content",
    authorId: "emily",
    createdAt: "Today, 10:22 AM",
    current: "Move work forward, faster.",
    proposal: "Turn product feedback into shipped improvements.",
    reviewerNote: "This needs to say what the product actually does.",
    assistantNote: "Should the message lead with feedback capture or faster delivery?",
  },
  cta: {
    number: 2,
    label: "PrimaryCTA · HomePage",
    shortLabel: "Start free trial button",
    category: "Interaction",
    authorId: "sam",
    createdAt: "Today, 9:48 AM",
    expected: "Open a focused sign-up step without losing page context.",
    observed: "The button jumps straight to pricing with no explanation.",
    reviewerNote: "The next step feels abrupt for a first-time visitor.",
    assistantNote: "I can add a short intent-preserving sign-up step before pricing.",
  },
  preview: {
    number: 3,
    label: "ProductPreview · HomePage",
    shortLabel: "Product dashboard preview",
    category: "Visual",
    authorId: "priya",
    createdAt: "Yesterday, 4:16 PM",
    visualNote: "Increase contrast in the preview and make the open feedback queue the focal point.",
    reviewerNote: "The product story gets lost inside the dashboard details.",
    assistantNote: "I can simplify the preview to one queue and one status summary.",
  },
};

const INITIAL_REPLIES = {
  hero: [],
  cta: [],
  preview: [],
};

const logoItems = [
  [SiLinear, "Linear"],
  [SiNotion, "Notion"],
  [SiWebflow, "webflow"],
  [SiVercel, "Vercel"],
  [SiLoom, "Loom"],
  [SiFigma, "Figma"],
];

function IconButton({ label, children, active = false, className = "", ...props }) {
  return (
    <button
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

function ReviewerAvatar({ reviewerId, size = "medium", className = "" }) {
  const reviewer = REVIEWERS[reviewerId];

  if (reviewer.avatar === "emily") {
    return (
      <img
        className={`avatar avatar--${size} ${className}`}
        src="/assets/reviewer-emily.png"
        alt={reviewer.name}
      />
    );
  }

  return (
    <span
      className={`avatar avatar--${size} avatar--initials avatar--${reviewer.id} ${className}`}
      role="img"
      aria-label={reviewer.name}
      title={`${reviewer.name} · ${reviewer.email}`}
    >
      {reviewer.initials}
    </span>
  );
}

function MemberList() {
  return (
    <div className="member-list">
      {Object.values(REVIEWERS).map((reviewer) => (
        <div className="member-row" key={reviewer.id}>
          <ReviewerAvatar reviewerId={reviewer.id} size="small" />
          <div>
            <strong>{reviewer.name}{reviewer.id === CURRENT_USER_ID && <span className="you-label">You</span>}</strong>
            <span>{reviewer.role}</span>
          </div>
          <span className="member-access">Can comment</span>
        </div>
      ))}
    </div>
  );
}

function AppHeader({ openShare, setOpenShare, openMembers, setOpenMembers, onCopyLink }) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="wordmark"><Wordmark size={26} /></span>
        <span className="app-header__divider" />
        <button className="session-switcher">
          Sessions <span>/</span> <strong>Marketing site refresh</strong>
          <CaretDown size={15} />
        </button>
      </div>

      <div className="session-status" aria-label="Review status">
        <span className="status-dot" />
        <span><strong>4 open</strong> · 3 resolved</span>
      </div>

      <div className="app-header__actions">
        <div className="members-wrap">
          <button
            className="member-stack-button"
            onClick={() => {
              setOpenMembers((value) => !value);
              setOpenShare(false);
            }}
            aria-expanded={openMembers}
            aria-label="View three session members"
          >
            <span className="member-stack" aria-hidden="true">
              {Object.keys(REVIEWERS).map((reviewerId) => (
                <ReviewerAvatar reviewerId={reviewerId} size="tiny" key={reviewerId} />
              ))}
            </span>
            <strong>3</strong>
          </button>
          {openMembers && (
            <div className="popover members-popover" role="dialog" aria-label="Session members">
              <div className="popover-title-row">
                <div><strong>Session members</strong><span>Everyone listed can view submitted feedback.</span></div>
                <LockKeyhole size={18} aria-hidden="true" />
              </div>
              <MemberList />
            </div>
          )}
        </div>
        <div className="share-wrap">
          <button
            className="share-button"
            onClick={() => {
              setOpenShare((value) => !value);
              setOpenMembers(false);
            }}
            aria-expanded={openShare}
          >
            <ShareNetwork size={18} />
            Share
          </button>
          {openShare && (
            <div className="popover share-popover" role="dialog" aria-label="Share review">
              <div className="popover-title-row">
                <div><strong>Private review session</strong><span>Only invited members can view and comment.</span></div>
                <LockKeyhole size={18} aria-hidden="true" />
              </div>
              <div className="share-access-summary">
                <span className="member-stack" aria-hidden="true">
                  {Object.keys(REVIEWERS).map((reviewerId) => (
                    <ReviewerAvatar reviewerId={reviewerId} size="tiny" key={reviewerId} />
                  ))}
                </span>
                <span><strong>3 members</strong> have access</span>
              </div>
              <button className="copy-session-link" onClick={onCopyLink}>
                <Copy size={16} /> Copy session link
              </button>
            </div>
          )}
        </div>
        <IconButton label="More session actions"><DotsThree size={24} /></IconButton>
      </div>
    </header>
  );
}

function ReviewToolbar({ activeTab, setActiveTab, zoom, setZoom, dark, setDark, narrow, setNarrow }) {
  const tabs = ["Review", "Notes", "Changes", "Activity"];

  return (
    <div className="review-toolbar">
      <nav className="review-tabs" aria-label="Review sections">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div className="review-toolbar__controls">
        <button
          className="zoom-control"
          onClick={() => setZoom((value) => (value === 100 ? 90 : value === 90 ? 80 : 100))}
          aria-label="Change preview zoom"
        >
          {zoom}% <CaretDown size={14} />
        </button>
        <IconButton label={dark ? "Use light page theme" : "Use dark page theme"} onClick={() => setDark((value) => !value)}>
          {dark ? <Sun size={21} /> : <Moon size={21} />}
        </IconButton>
        <IconButton label="Toggle compact preview" active={narrow} onClick={() => setNarrow((value) => !value)}>
          <DeviceMobile size={21} />
        </IconButton>
      </div>
    </div>
  );
}

function SelectionMarker({ number }) {
  return <span className="selection-marker" aria-hidden="true">{number}</span>;
}

function SelectionHandles() {
  return (
    <>
      <span className="selection-handle selection-handle--tl" aria-hidden="true" />
      <span className="selection-handle selection-handle--tr" aria-hidden="true" />
      <span className="selection-handle selection-handle--bl" aria-hidden="true" />
      <span className="selection-handle selection-handle--br" aria-hidden="true" />
    </>
  );
}

function ReviewedSite({ selectedKey, onSelect, toolMode, dark, narrow, zoom }) {
  const choose = (event, key) => {
    if (toolMode !== "pointer" && toolMode !== "text") return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(key);
  };

  return (
    <div className={`preview-stage ${narrow ? "is-narrow" : ""}`}>
      <article
        className={`reviewed-site ${dark ? "is-dark" : ""}`}
        style={{ "--preview-zoom": zoom / 100 }}
      >
        <nav className="site-nav" aria-label="Northstar site navigation">
          <button className="site-brand" onClick={(event) => choose(event, "hero")}>Northstar</button>
          <div className="site-nav__links">
            <a href="#product">Product</a>
            <a href="#solutions">Solutions</a>
            <a href="#customers">Customers</a>
            <a href="#pricing">Pricing</a>
            <a href="#resources">Resources</a>
          </div>
          <div className="site-nav__actions">
            <button className="text-button">Log in</button>
            <button className="site-button site-button--small">Get started</button>
          </div>
        </nav>

        <section className="site-hero" id="product">
          <div className="site-hero__copy">
            <button
              className={`target target--hero ${selectedKey === "hero" ? "is-selected" : ""}`}
              onClick={(event) => choose(event, "hero")}
              aria-label="Select hero heading for feedback"
            >
              <h1>Move work<br />forward, faster.</h1>
              {selectedKey === "hero" && <><SelectionHandles /><SelectionMarker number={TARGETS.hero.number} /></>}
            </button>
            <p>
              Collect product feedback, align your team, and ship<br className="wide-only" />
              improvements your users will love.
            </p>
            <div className="site-hero__actions">
              <button
                className={`site-button target target--cta ${selectedKey === "cta" ? "is-selected" : ""}`}
                onClick={(event) => choose(event, "cta")}
              >
                Start free trial
                {selectedKey === "cta" && <><SelectionHandles /><SelectionMarker number={TARGETS.cta.number} /></>}
              </button>
              <button className="site-button site-button--secondary">Book a demo</button>
            </div>
            <div className="benefits" aria-label="Product benefits">
              <div><ChatCircleText size={22} /><span>Capture feedback<br />from any channel</span></div>
              <div><UsersThree size={22} /><span>Prioritize with<br />confidence</span></div>
              <div><RocketLaunch size={22} /><span>Ship with impact<br />and clarity</span></div>
            </div>
          </div>

          <button
            className={`product-visual target target--visual ${selectedKey === "preview" ? "is-selected" : ""}`}
            onClick={(event) => choose(event, "preview")}
            aria-label="Select product preview for visual feedback"
          >
            <img src="/assets/product-feedback-dashboard.png" alt="Feedback queue and status dashboard" />
            {selectedKey === "preview" && <><SelectionHandles /><SelectionMarker number={TARGETS.preview.number} /></>}
          </button>
        </section>

        <section className="trusted-strip">
          <p>Trusted by product teams at</p>
          <div className="logo-row">
            {logoItems.map(([Logo, name]) => (
              <span key={name}><Logo aria-hidden="true" /><strong>{name}</strong></span>
            ))}
          </div>
        </section>

        <section className="how-it-works" id="solutions">
          <div>
            <span className="eyebrow">How it works</span>
            <h2>A better way to turn feedback<br />into outcomes</h2>
          </div>
          <p>
            Northstar helps you collect feedback, surface what matters,
            and ship improvements—faster.
          </p>
          <div className="process-steps" aria-label="How it works steps">
            <span><ChatCircleText size={27} /><em>Capture</em></span>
            <i />
            <span><UsersThree size={27} /><em>Align</em></span>
            <i />
            <span><RocketLaunch size={27} /><em>Ship</em></span>
          </div>
        </section>
      </article>
    </div>
  );
}

function FloatingTools({ toolMode, setToolMode }) {
  return (
    <div className="floating-tools" aria-label="Annotation tools">
      <IconButton label="Select an element" active={toolMode === "pointer"} onClick={() => setToolMode("pointer")}>
        <Cursor size={23} />
      </IconButton>
      <IconButton label="Select text" active={toolMode === "text"} onClick={() => setToolMode("text")}>
        <TextT size={23} />
      </IconButton>
    </div>
  );
}

function CategoryMenu({ category, setCategory, open, setOpen }) {
  const categories = ["Content", "Visual", "Interaction"];
  return (
    <div className="category-wrap">
      <button className="category-button" onClick={() => setOpen((value) => !value)}>
        {category} {open ? <CaretDown size={14} /> : <CaretUp size={14} />}
      </button>
      {open && (
        <div className="popover category-menu" role="menu">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? "is-selected" : ""}
              onClick={() => { setCategory(item); setOpen(false); }}
            >
              {item}
              {category === item && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewerComment({ children, reviewerId, time = "Today, 10:22 AM" }) {
  const reviewer = REVIEWERS[reviewerId];

  return (
    <div className="thread-comment">
      <ReviewerAvatar reviewerId={reviewerId} />
      <div>
        <div className="comment-meta">
          <strong>{reviewer.name}</strong>
          {reviewerId === CURRENT_USER_ID && <span className="you-label">You</span>}
          <span>{time}</span>
        </div>
        <p>{children}</p>
      </div>
    </div>
  );
}

function AssistantComment({ children, thinking = false, time = "Today, 10:24 AM" }) {
  return (
    <div className="thread-comment">
      <span className="assistant-avatar" aria-label="Threadmark assistant">
        <Sparkle size={19} />
      </span>
      <div>
        <div className="comment-meta">
          <strong>Threadmark Assistant</strong><span>{time}</span>
          <IconButton label="Assistant reply actions" className="comment-actions"><DotsThree size={19} /></IconButton>
        </div>
        <p className={thinking ? "thinking" : ""}>{children}</p>
      </div>
    </div>
  );
}

function FeedbackFields({ targetKey, category, drafts, updateDraft }) {
  const target = TARGETS[targetKey];

  if (category === "Content") {
    return (
      <div className="feedback-fields">
        <label>Current copy</label>
        <div className="copy-box copy-box--current">{target.current || target.shortLabel}</div>
        <label htmlFor="proposal">Proposed replacement</label>
        <textarea
          id="proposal"
          className="copy-box copy-box--proposal"
          value={drafts[targetKey].proposal}
          onChange={(event) => updateDraft(targetKey, "proposal", event.target.value)}
          rows={3}
        />
      </div>
    );
  }

  if (category === "Interaction") {
    return (
      <div className="feedback-fields">
        <label htmlFor="expected">Expected behavior</label>
        <textarea
          id="expected"
          className="behavior-box"
          value={drafts[targetKey].expected}
          onChange={(event) => updateDraft(targetKey, "expected", event.target.value)}
          rows={3}
        />
        <label htmlFor="observed">Observed behavior</label>
        <textarea
          id="observed"
          className="behavior-box behavior-box--observed"
          value={drafts[targetKey].observed}
          onChange={(event) => updateDraft(targetKey, "observed", event.target.value)}
          rows={3}
        />
      </div>
    );
  }

  return (
    <div className="feedback-fields">
      <label htmlFor="visual-note">What should change?</label>
      <textarea
        id="visual-note"
        className="visual-note-box"
        value={drafts[targetKey].visualNote}
        onChange={(event) => updateDraft(targetKey, "visualNote", event.target.value)}
        rows={5}
      />
      <div className="target-context">
        <span>Target</span>
        <strong>{target.shortLabel}</strong>
        <code>{targetKey === "preview" ? ".hero-product-preview" : ".selected-element"}</code>
      </div>
    </div>
  );
}

function ThreadComposer({ reply, setReply, onSend }) {
  return (
    <div className="thread-composer">
      <textarea
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder="Reply to thread…"
        aria-label="Reply to feedback thread"
        rows={2}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSend();
        }}
      />
      <div>
        <span className="composer-tools"><At size={20} /><Paperclip size={20} /></span>
        <button className="send-button" disabled={!reply.trim()} onClick={onSend}>
          Post reply
          <PaperPlaneTilt size={18} />
        </button>
      </div>
    </div>
  );
}

function ReviewPanel({
  selectedKey,
  category,
  setCategory,
  drafts,
  updateDraft,
  replies,
  reply,
  setReply,
  onSend,
  onClose,
  resolved,
  onResolve,
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const target = TARGETS[selectedKey];

  return (
    <>
      <div className="panel-header">
        <span className={`panel-marker ${resolved ? "is-resolved" : ""}`}>
          {resolved ? <Check size={17} /> : target.number}
        </span>
        <strong>{target.label}</strong>
        <div className="panel-header__actions">
          <div className="more-wrap">
            <IconButton label="More feedback actions" onClick={() => setMoreOpen((value) => !value)}>
              <DotsThree size={24} />
            </IconButton>
            {moreOpen && (
              <div className="popover more-menu">
                <button onClick={() => { onResolve(); setMoreOpen(false); }}>
                  <CheckCircle size={17} /> {resolved ? "Reopen feedback" : "Mark as resolved"}
                </button>
                <button onClick={() => navigator.clipboard?.writeText(`#${target.number} ${target.label}`)}>
                  <Copy size={17} /> Copy feedback link
                </button>
              </div>
            )}
          </div>
          <IconButton label="Close feedback panel" onClick={onClose}><X size={22} /></IconButton>
        </div>
      </div>

      <div className="panel-scroll">
        <div className="annotation-author">
          <ReviewerAvatar reviewerId={target.authorId} size="small" />
          <div>
            <span>Feedback by</span>
            <strong>{REVIEWERS[target.authorId].name}{target.authorId === CURRENT_USER_ID && <span className="you-label">You</span>}</strong>
            <small>{REVIEWERS[target.authorId].role} · {target.createdAt}</small>
          </div>
          <button className="visibility-pill" title="Visible to invited session members">
            <LockKeyhole size={14} /> 3 members
          </button>
        </div>
        <CategoryMenu
          category={category}
          setCategory={setCategory}
          open={categoryOpen}
          setOpen={setCategoryOpen}
        />
        <FeedbackFields
          targetKey={selectedKey}
          category={category}
          drafts={drafts}
          updateDraft={updateDraft}
        />

        <div className="thread-list">
          <ReviewerComment reviewerId={target.authorId} time={target.createdAt}>{target.reviewerNote}</ReviewerComment>
          <AssistantComment>{target.assistantNote}</AssistantComment>
          {replies[selectedKey].map((message) => (
            message.role === "reviewer"
              ? <ReviewerComment key={message.id} reviewerId={message.authorId} time="Just now">{message.text}</ReviewerComment>
              : <AssistantComment key={message.id} thinking={message.thinking} time="Just now">{message.text}</AssistantComment>
          ))}
        </div>
      </div>

      <div className="panel-footer">
        <ThreadComposer reply={reply} setReply={setReply} onSend={onSend} />
        <div className="draft-visibility"><LockKeyhole size={13} /> Draft is private until you post it.</div>
        <div className="updated-line">
          <ClockCounterClockwise size={18} />
          Submitted feedback is shared with invited members
        </div>
      </div>
    </>
  );
}

function ReviewerFilter({ value, onChange }) {
  return (
    <div className="reviewer-filter" aria-label="Filter feedback by reviewer">
      <span><ListFilter size={15} /> Reviewer</span>
      <div>
        <button className={value === "all" ? "is-active" : ""} onClick={() => onChange("all")}>All</button>
        {Object.values(REVIEWERS).map((reviewer) => (
          <button
            className={value === reviewer.id ? "is-active" : ""}
            onClick={() => onChange(reviewer.id)}
            key={reviewer.id}
          >
            <ReviewerAvatar reviewerId={reviewer.id} size="micro" />
            {reviewer.shortName}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryPanel({ tab, onReturn, reviewerFilter, setReviewerFilter, onSelect }) {
  const content = {
    Notes: {
      title: "All notes",
      intro: "Three focused notes are attached to this page.",
      items: ["Hero message needs a concrete outcome", "Trial CTA skips context", "Preview lacks a clear focal point"],
    },
    Changes: {
      title: "Suggested changes",
      intro: "Agent-ready edits from the current review pass.",
      items: ["Replace hero headline", "Add intent step before pricing", "Simplify product preview"],
    },
    Activity: {
      title: "Session activity",
      intro: "The latest work from this review session.",
      items: ["Emily added content feedback", "Assistant asked a clarification", "Sam resolved footer spacing"],
    },
  }[tab];

  const visibleNotes = Object.entries(TARGETS).filter(([, target]) => (
    reviewerFilter === "all" || target.authorId === reviewerFilter
  ));

  return (
    <div className="summary-panel">
      <div className="summary-panel__header">
        <div><span className="eyebrow">{tab}</span><h2>{content.title}</h2></div>
        <button onClick={onReturn}><ArrowRight size={18} /> Return to review</button>
      </div>
      <p>{content.intro}</p>
      {tab === "Notes" ? (
        <>
          <ReviewerFilter value={reviewerFilter} onChange={setReviewerFilter} />
          <div className="feedback-summary-list" aria-live="polite">
            {visibleNotes.map(([key, target]) => (
              <button className="feedback-summary-card" key={key} onClick={() => onSelect(key)}>
                <span className="panel-marker">{target.number}</span>
                <div>
                  <strong>{target.shortLabel}</strong>
                  <p>{target.reviewerNote}</p>
                  <span className="summary-author"><ReviewerAvatar reviewerId={target.authorId} size="micro" /> {REVIEWERS[target.authorId].name} · {target.createdAt}</span>
                </div>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            ))}
            {visibleNotes.length === 0 && <p className="empty-filter">No feedback from this reviewer.</p>}
          </div>
        </>
      ) : (
        <ol>
          {content.items.map((item, index) => (
            <li key={item}><span>{index + 1}</span><strong>{item}</strong></li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ReviewPrototype() {
  const [selectedKey, setSelectedKey] = useState("hero");
  const [panelOpen, setPanelOpen] = useState(true);
  const [category, setCategory] = useState(TARGETS.hero.category);
  const [toolMode, setToolMode] = useState("pointer");
  const [activeTab, setActiveTab] = useState("Review");
  const [openShare, setOpenShare] = useState(false);
  const [openMembers, setOpenMembers] = useState(false);
  const [reviewerFilter, setReviewerFilter] = useState("all");
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [reply, setReply] = useState("");
  const [replies, setReplies] = useState(INITIAL_REPLIES);
  const [resolvedKeys, setResolvedKeys] = useState([]);
  const [toast, setToast] = useState("");
  const [drafts, setDrafts] = useState(() => Object.fromEntries(
    Object.entries(TARGETS).map(([key, target]) => [key, {
      proposal: target.proposal || "",
      expected: target.expected || "",
      observed: target.observed || "",
      visualNote: target.visualNote || "",
    }]),
  ));

  const resolved = resolvedKeys.includes(selectedKey);

  const selectTarget = (key) => {
    setSelectedKey(key);
    setCategory(TARGETS[key].category);
    setPanelOpen(true);
    setActiveTab("Review");
    setReply("");
  };

  const updateDraft = (key, field, value) => {
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  };

  const sendReply = () => {
    const cleanReply = reply.trim();
    if (!cleanReply) return;
    const activeKey = selectedKey;
    const timestamp = Date.now();
    setReplies((current) => ({
      ...current,
      [activeKey]: [
        ...current[activeKey],
        { id: `reviewer-${timestamp}`, role: "reviewer", authorId: CURRENT_USER_ID, text: cleanReply },
      ],
    }));
    setReply("");
    setToast("Reply shared with 3 session members");
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleResolved = () => {
    setResolvedKeys((current) => (
      current.includes(selectedKey)
        ? current.filter((key) => key !== selectedKey)
        : [...current, selectedKey]
    ));
    setToast(resolved ? "Feedback reopened" : "Feedback resolved");
  };

  return (
    <div className="app-shell">
      <AppHeader
        openShare={openShare}
        setOpenShare={setOpenShare}
        openMembers={openMembers}
        setOpenMembers={setOpenMembers}
        onCopyLink={() => {
          navigator.clipboard?.writeText(window.location.href);
          setToast("Private session link copied");
        }}
      />
      <div className={`workspace-grid ${panelOpen ? "" : "panel-is-closed"}`}>
        <main className="review-workspace">
          <ReviewToolbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            zoom={zoom}
            setZoom={setZoom}
            dark={dark}
            setDark={setDark}
            narrow={narrow}
            setNarrow={setNarrow}
          />
          <div className="canvas-wrap">
            <ReviewedSite
              selectedKey={selectedKey}
              onSelect={selectTarget}
              toolMode={toolMode}
              dark={dark}
              narrow={narrow}
              zoom={zoom}
            />
            <FloatingTools toolMode={toolMode} setToolMode={setToolMode} />
            {toolMode === "text" && <div className="mode-hint">Text mode · choose copy on the page</div>}
          </div>
        </main>

        {panelOpen && (
          <aside className="feedback-panel" aria-label="Feedback details">
            {activeTab === "Review" ? (
              <ReviewPanel
                selectedKey={selectedKey}
                category={category}
                setCategory={setCategory}
                drafts={drafts}
                updateDraft={updateDraft}
                replies={replies}
                reply={reply}
                setReply={setReply}
                onSend={sendReply}
                onClose={() => setPanelOpen(false)}
                resolved={resolved}
                onResolve={toggleResolved}
              />
            ) : (
              <SummaryPanel
                tab={activeTab}
                onReturn={() => setActiveTab("Review")}
                reviewerFilter={reviewerFilter}
                setReviewerFilter={setReviewerFilter}
                onSelect={selectTarget}
              />
            )}
          </aside>
        )}

        {!panelOpen && (
          <button className="reopen-panel" onClick={() => setPanelOpen(true)}>
            <span>{TARGETS[selectedKey].number}</span>
            Open feedback
          </button>
        )}
      </div>
      {toast && <div className="toast" role="status"><CheckCircle size={18} />{toast}</div>}
    </div>
  );
}

export function App() {
  return window.location.pathname === "/about" ? <ProjectPage /> : <ReviewPrototype />;
}
