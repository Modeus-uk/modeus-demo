/* ============================================================
   Modeus demo — personalised, deterministic iMessage flow
   - Slug routing (/theuncommon) via prospects.json
   - Query-param fallback (?first_name=&company=)
   - Branching quick-reply conversation (no free text)
   ============================================================ */

const params = new URLSearchParams(window.location.search);

/* ---------- DOM ---------- */
const headlineEl = document.getElementById("headline");
const chat = document.getElementById("chat");
const quickReplies = document.getElementById("quickReplies");

/* Force chips hidden on load — revealed only once a question is ready. */
hideChips();

/* ---------- Slug ---------- */
const slug = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();

let companyDisplay = "your business"; // resolved in startConversation, used by later branches

init();

/* ============================================================
   INIT / PERSONALISATION
   ============================================================ */
async function init() {
  const prospect = await resolveProspect();
  applyHeadline(prospect);
  startConversation(prospect);
}

async function resolveProspect() {
  // 1. Slug match from prospects.json
  if (slug && slug !== "index.html") {
    try {
      const res = await fetch("/prospects.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data[slug]) return data[slug];
      }
    } catch (e) {
      /* fall through to query params */
    }
  }

  // 2. Query-param fallback
  const qpFirst = (params.get("first_name") || "").trim();
  const qpCompany = (params.get("company") || "").trim();
  const qpLead = (params.get("lead_type") || "").trim();
  if (qpFirst || qpCompany) {
    return { firstName: qpFirst, company: qpCompany, leadType: qpLead };
  }

  // 3. No prospect
  return null;
}

function applyHeadline(prospect) {
  const firstName = prospect && prospect.firstName ? String(prospect.firstName).trim() : "";
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},<br />` : "";
  headlineEl.innerHTML = `${greeting}Missed calls shouldn’t mean missed opportunities.`;
}

/* ============================================================
   CONVERSATION
   ============================================================ */
function startConversation(prospect) {
  const company = prospect && prospect.company ? String(prospect.company).trim() : "";
  const leadType = (prospect && prospect.leadType && String(prospect.leadType).trim()) || "enquiry";
  companyDisplay = company || "your business";

  const opening = prospect
    ? `Hi, does ${companyDisplay} reply to every ${leadType} quickly enough?`
    : "Hi, are you replying to every enquiry fast enough?";

  addBubble(opening, "incoming");
  // Reveal first quick replies only after the opening question is on screen.
  setTimeout(() => showChips(FIRST_CHIPS), 550);
}

/* ---------- First question ---------- */
const FIRST_CHIPS = [
  { label: "Yes", run: pathYesFirst },
  { label: "No", run: pathNo },
  { label: "Not sure", run: pathNotSure },
];

/* ---------- Second question (after first "Yes") ---------- */
const SECOND_CHIPS = [
  { label: "Yes", run: pathYesSecond },
  { label: "No", run: pathNoSecond },
  { label: "Not sure", run: pathNotSure },
];

/* Path 1 — first "No" */
function pathNo() {
  addBubble("No, not always.", "outgoing");
  streamIncoming(
    [
      "That’s exactly why we built this.",
      "When someone calls, texts or sends a WhatsApp message, Modeus replies instantly, asks the right questions, and sends the team a clean summary.",
      "Want to see this working on your own number?",
    ],
    () => showCtaChips()
  );
}

/* Path 2 — first "Yes" */
function pathYesFirst() {
  addBubble("Yes.", "outgoing");
  streamIncoming(
    [
      "Good.",
      "Do you also track response time, follow-up status, and outcome for every enquiry?",
    ],
    () => showChips(SECOND_CHIPS)
  );
}

/* Path 2A — second "Yes" */
function pathYesSecond() {
  addBubble("Yes.", "outgoing");
  streamIncoming(
    [
      "Then you’re ahead of most teams.",
      "The next opportunity is consistency: making sure every enquiry gets the same instant follow-up, every time.",
      "Want us to show you how Modeus would fit around your current process?",
    ],
    () => showCtaChips({ bookFirst: true })
  );
}

/* Path 2B — second "No" */
function pathNoSecond() {
  addBubble("No.", "outgoing");
  streamIncoming(
    [
      "That’s usually the blind spot.",
      "Most businesses know enquiries are coming in, but they don’t always know how quickly they were handled, what happened next, or which ones went cold.",
      `Want us to show you what this would look like for ${companyDisplay}?`,
    ],
    () => showCtaChips()
  );
}

/* Path 3 — "Not sure" at any point */
function pathNotSure() {
  addBubble("Not sure.", "outgoing");
  streamIncoming(
    [
      "That’s where most teams lose useful insight.",
      "If you can’t see response time, follow-up status, and outcome clearly, you’re relying on memory and good intentions.",
      "We make it visible without adding more admin.",
      `Want to see how that would work inside ${companyDisplay}?`,
    ],
    () => showCtaChips()
  );
}

/* ============================================================
   FINAL CTA CHIPS
   ============================================================ */
function showCtaChips(opts) {
  const tryChip = { label: "Try it myself", run: goToDemo };
  const bookChip = { label: "Book a call", run: goToBookCall };
  const chips = opts && opts.bookFirst ? [bookChip, tryChip] : [tryChip, bookChip];
  showChips(chips, true); // final = true: navigation, no outgoing bubble, stays tappable
}

function goToDemo() {
  const pi = document.querySelector(".cta-card .phone-input");
  if (pi) pi.classList.add("highlight");
  scrollToEl("demo");
}

function goToBookCall() {
  scrollToEl("demo");
}

function scrollToEl(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ============================================================
   CHIP RENDERING
   ============================================================ */
function showChips(chips, final) {
  quickReplies.innerHTML = "";
  let used = false;

  chips.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = c.label;
    btn.addEventListener("click", () => {
      if (final) {
        c.run();
        return; // CTA chips stay visible and tappable
      }
      if (used) return; // single answer per question
      used = true;
      hideChips();
      c.run();
    });
    quickReplies.appendChild(btn);
  });

  quickReplies.style.display = "flex";
  quickReplies.classList.add("visible");
  chat.scrollTop = chat.scrollHeight;
}

function hideChips() {
  quickReplies.style.display = "none";
  quickReplies.classList.remove("visible");
  quickReplies.innerHTML = "";
}

/* ============================================================
   CTA FORM (bottom of page)
   ============================================================ */
const ctaForm = document.getElementById("ctaForm");
const ctaSuccess = document.getElementById("ctaSuccess");
ctaForm.addEventListener("submit", (e) => {
  e.preventDefault();
  ctaSuccess.hidden = false;
});

/* ============================================================
   HELPERS
   ============================================================ */
function streamIncoming(messages, done) {
  messages.forEach((msg, i) => {
    setTimeout(() => {
      addBubble(msg, "incoming");
      if (i === messages.length - 1 && done) done();
    }, 500 + i * 850);
  });
}

function addBubble(text, cls) {
  const el = document.createElement("div");
  el.className = "bubble " + cls;
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
