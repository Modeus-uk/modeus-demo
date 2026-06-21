/* ============================================================
   Modeus demo — personalised, deterministic iMessage flow
   - Slug routing (/theuncommon) via prospects.json
   - Query-param fallback (?first_name=&company=)
   - Branching quick-reply conversation (no free text)
   ============================================================ */

/* Optional Google Sheet CSV source. Leave empty to use prospects.json. */
const PROSPECTS_SOURCE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFsAu2BAmUTwOGPM96VDFUv2T3iR3qLeZ_vkWiwwHAIvP7cCIdhn1VXyK4mUhflPawtn8mc4XrNaPX/pub?gid=0&single=true&output=csv";

const params = new URLSearchParams(window.location.search);

/* ---------- DOM ---------- */
const headlineEl = document.getElementById("headline");
const chat = document.getElementById("chat");
const quickReplies = document.getElementById("quickReplies");

/* iPhone shows a static WhatsApp brief — interactive conversation disabled. */

/* Booking link used by every Book a call button. */
const BOOKING_URL = "https://calendly.com/modeus/30min";

/* ---------- Route: vertical + slug ----------
   /:slug            -> generic vertical, slug = first segment (unchanged behaviour)
   /property/:slug   -> property vertical, slug = second segment                       */
const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
const pathParts = rawPath ? rawPath.split("/") : [];
let vertical = "generic";
let slug;
if (pathParts[0] === "property") {
  vertical = "property";
  slug = pathParts[1] || "";
} else {
  slug = rawPath;
}

let companyDisplay = "your business"; // resolved in startConversation, used by later branches
let currentProspect = null; // resolved in init(), read by the SMS demo form

init();

/* ============================================================
   INIT / PERSONALISATION
   ============================================================ */
async function init() {
  const prospect = await resolveProspect();
  currentProspect = prospect;
  applyHeadline(prospect);
  applyVertical();
  // startConversation(prospect); // disabled: static WhatsApp brief
}

/* Property vertical: swap the hero-left body copy and add the guarantee + Book a call. */
function applyVertical() {
  if (vertical !== "property") return;
  const heroLeft = document.querySelector(".hero-left");
  if (!heroLeft) return;

  const bodyParas = heroLeft.querySelectorAll(".body-text");
  if (bodyParas[0]) {
    bodyParas[0].textContent = "The sourcing layer that stops information getting lost.";
  }
  if (bodyParas[1]) {
    bodyParas[1].textContent =
      "Modeus turns scattered seller messages, calls and deal notes into a live deal pipeline, without making you move your business into another system.";
  }

  const anchor = bodyParas[1] || bodyParas[0];
  if (!anchor) return;

  const guarantee = document.createElement("p");
  guarantee.className = "body-text";
  guarantee.innerHTML =
    "<strong>We’ll capture your first missed opportunity before you pay a monthly fee.</strong>";

  const ctaWrap = document.createElement("div");
  ctaWrap.style.margin = "4px 0 18px";
  const bookBtn = document.createElement("a");
  bookBtn.className = "btn-secondary";
  bookBtn.href = BOOKING_URL;
  bookBtn.target = "_blank";
  bookBtn.rel = "noopener";
  bookBtn.textContent = "Book a call";
  ctaWrap.appendChild(bookBtn);

  const clarify = document.createElement("p");
  clarify.className = "consent";
  clarify.textContent = "You only pay the setup to get live.";

  anchor.after(guarantee, ctaWrap, clarify);
}

async function resolveProspect() {
  // 1. Slug match from the configured source (CSV) or prospects.json
  if (slug && slug !== "index.html") {
    const matched = PROSPECTS_SOURCE_URL ? await lookupCsv(slug) : await lookupJson(slug);
    if (matched) return matched;
  }

  // 2. Query-param fallback
  const qpFirst = (params.get("first_name") || "").trim();
  const qpCompany = (params.get("company") || "").trim();
  const qpLead = (params.get("lead_type") || "").trim();
  if (qpFirst || qpCompany) {
    return { firstName: qpFirst, company: qpCompany, leadType: qpLead };
  }

  // 3. No prospect -> default homepage
  return null;
}

/* Lookup a slug in prospects.json (fallback source). */
async function lookupJson(targetSlug) {
  try {
    const res = await fetch("/prospects.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data[targetSlug] ? data[targetSlug] : null;
  } catch (e) {
    return null;
  }
}

/* Lookup a slug in a Google Sheet CSV export. */
async function lookupCsv(targetSlug) {
  try {
    const res = await fetch(PROSPECTS_SOURCE_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const rows = parseCsv(await res.text());
    const row = rows.find((r) => getField(r, "slug").toLowerCase() === targetSlug);
    if (!row) return null;
    return {
      firstName: getField(row, "firstName"),
      company: getField(row, "company"),
      website: getField(row, "website"),
      leadType: getField(row, "leadType"),
    };
  } catch (e) {
    return null;
  }
}

/* Case-insensitive column read from a parsed CSV row. */
function getField(row, name) {
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === name.toLowerCase());
  return key ? String(row[key] || "").trim() : "";
}

/* Minimal CSV parser: handles quoted fields, escaped quotes, and CRLF. */
function parseCsv(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] !== undefined ? cells[i] : "";
    });
    return obj;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
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
  window.open(BOOKING_URL, "_blank", "noopener");
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
const N8N_WEBHOOK_URL = "https://tailoredworkflow.app.n8n.cloud/webhook/modeus-demo-request";
const N8N_PROPERTY_WEBHOOK_URL = "https://tailoredworkflow.app.n8n.cloud/webhook/modeus-property-demo-request";
const ctaForm = document.getElementById("ctaForm");
const ctaSuccess = document.getElementById("ctaSuccess");
const ctaSubmitBtn = ctaForm.querySelector('button[type="submit"]');
const ctaSubmitLabel = ctaSubmitBtn ? ctaSubmitBtn.textContent : "";
let ctaSubmitted = false; // blocks repeat submits after success

ctaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (ctaSubmitted) return; // no repeat submit after success

  const phoneInputEl = ctaForm.querySelector('input[type="tel"]');
  const phone = phoneInputEl ? phoneInputEl.value.trim() : "";
  if (!phone) {
    if (phoneInputEl) phoneInputEl.focus();
    return; // no false success on empty phone
  }

  const payload = {
    firstName: (currentProspect && currentProspect.firstName) || "",
    company: (currentProspect && currentProspect.company) || "",
    phone: phone,
    slug: slug,
    pageUrl: window.location.href,
  };
  if (vertical === "property") {
    payload.vertical = "property";
    payload.offerType = "deal_capture";
  }

  if (ctaSubmitBtn) {
    ctaSubmitBtn.disabled = true;
    ctaSubmitBtn.textContent = "Sending...";
  }

  try {
    const res = await fetch(vertical === "property" ? N8N_PROPERTY_WEBHOOK_URL : N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Webhook responded " + res.status);

    const successText = ctaSuccess.querySelector(".success-text");
    if (successText) successText.textContent = "Demo sent. Check your phone.";
    ctaSuccess.hidden = false; // Book a call link inside the block is preserved
    ctaSubmitted = true;
    if (ctaSubmitBtn) ctaSubmitBtn.textContent = "Sent!"; // stays disabled
  } catch (err) {
    if (ctaSubmitBtn) {
      ctaSubmitBtn.textContent = ctaSubmitLabel; // restore "Build my demo"
      ctaSubmitBtn.disabled = false; // allow retry, no false success
    }
  }
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
